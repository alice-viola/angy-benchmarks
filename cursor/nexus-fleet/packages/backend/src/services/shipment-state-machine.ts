import { eq, and, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Database } from '../db/connection.js';
import * as schema from '../db/schema.js';
import type { ShipmentStatus } from '@nexus-fleet/shared';
import { SHIPMENT_TRANSITIONS } from '@nexus-fleet/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransitionData {
  vehicleId?: string;
  driverId?: string;
  cancellationReason?: string;
  failureReason?: string;
  podSignature?: string;
  podPhotoUrls?: string[];
  podNotes?: string;
  notes?: string;
}

interface TransitionContext {
  shipment: typeof schema.shipments.$inferSelect;
  data: TransitionData;
  userId: string;
  tenantId: string;
  now: Date;
}

type GuardFn = (ctx: TransitionContext) => string | null;
type SideEffectFn = (ctx: TransitionContext, tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<void>;

interface TransitionDef {
  guards: GuardFn[];
  sideEffects: SideEffectFn[];
}

export interface TransitionResult {
  success: boolean;
  shipmentId: string;
  fromStatus: ShipmentStatus;
  toStatus: ShipmentStatus;
  referenceCode: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const requireFields: GuardFn = (ctx) => {
  const s = ctx.shipment;
  if (!s.originAddress) return 'Origin address is required';
  if (!s.destAddress) return 'Destination address is required';
  if (!s.weightKg) return 'Cargo weight is required';
  return null;
};

const maxWeight: GuardFn = (ctx) => {
  const weight = Number(ctx.shipment.weightKg);
  if (weight > 50_000) return `Cargo weight ${weight}kg exceeds maximum 50,000kg`;
  return null;
};

const tempControlCheck: GuardFn = (ctx) => {
  if (ctx.shipment.cargoType === 'perishable' && !ctx.shipment.cargoDescription) {
    return 'Perishable cargo requires a cargo description with temperature control info';
  }
  return null;
};

const requireCancellationReason: GuardFn = (ctx) => {
  if (!ctx.data.cancellationReason) return 'Cancellation reason is required';
  return null;
};

const requireVehicleAndDriver: GuardFn = (ctx) => {
  if (!ctx.data.vehicleId) return 'Vehicle ID is required for assignment';
  if (!ctx.data.driverId) return 'Driver ID is required for assignment';
  return null;
};

const requirePOD: GuardFn = (ctx) => {
  if (!ctx.data.podSignature && (!ctx.data.podPhotoUrls || ctx.data.podPhotoUrls.length === 0)) {
    return 'Proof of delivery required (signature URL or photo)';
  }
  return null;
};

const requireFailureReason: GuardFn = (ctx) => {
  if (!ctx.data.failureReason) return 'Failure reason is required';
  return null;
};

const validatePickupWindow: GuardFn = (ctx) => {
  if (!ctx.shipment.scheduledPickup) return null;
  const scheduled = new Date(ctx.shipment.scheduledPickup).getTime();
  const now = ctx.now.getTime();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  if (Math.abs(now - scheduled) > twoHoursMs) {
    return 'Pickup must be within 2 hours of the scheduled pickup time';
  }
  return null;
};

// ---------------------------------------------------------------------------
// Side Effects
// ---------------------------------------------------------------------------

function generateReferenceCode(redis: Redis, tenantId: string): SideEffectFn {
  return async (ctx, tx) => {
    const dateStr = ctx.now.toISOString().slice(0, 10).replace(/-/g, '');
    const seqKey = `shipment_seq:${tenantId}:${dateStr}`;
    const seq = await redis.incr(seqKey);
    await redis.expire(seqKey, 172_800); // 48h TTL
    const referenceCode = `SHP-${dateStr}-${String(seq).padStart(5, '0')}`;

    await tx
      .update(schema.shipments)
      .set({ referenceCode, updatedAt: ctx.now })
      .where(eq(schema.shipments.id, ctx.shipment.id));

    ctx.shipment = { ...ctx.shipment, referenceCode };
  };
}

function checkVehicleCapacityAndAvailability(): SideEffectFn {
  return async (ctx, tx) => {
    const [vehicle] = await tx
      .select()
      .from(schema.vehicles)
      .where(
        and(
          eq(schema.vehicles.id, ctx.data.vehicleId!),
          eq(schema.vehicles.tenantId, ctx.tenantId),
        ),
      );

    if (!vehicle) throw new Error('Vehicle not found');
    if (!vehicle.isActive) throw new Error('Vehicle is not active');
    if (vehicle.status !== 'available') throw new Error(`Vehicle is not available (current status: ${vehicle.status})`);

    const shipmentWeight = Number(ctx.shipment.weightKg ?? 0);
    const vehicleCapacity = Number(vehicle.capacityKg ?? 0);
    if (vehicleCapacity > 0 && shipmentWeight > vehicleCapacity) {
      throw new Error(`Shipment weight ${shipmentWeight}kg exceeds vehicle capacity ${vehicleCapacity}kg`);
    }

    if (ctx.shipment.cargoType === 'perishable' && vehicle.type !== 'refrigerated') {
      throw new Error('Perishable cargo requires a refrigerated vehicle');
    }
  };
}

function checkDriverAvailability(): SideEffectFn {
  return async (ctx, tx) => {
    const [driver] = await tx
      .select()
      .from(schema.drivers)
      .where(
        and(
          eq(schema.drivers.id, ctx.data.driverId!),
          eq(schema.drivers.tenantId, ctx.tenantId),
        ),
      );

    if (!driver) throw new Error('Driver not found');
    if (!driver.isActive) throw new Error('Driver is not active');
    if (driver.status !== 'available') throw new Error(`Driver is not available (current status: ${driver.status})`);
  };
}

function assignVehicleAndDriver(): SideEffectFn {
  return async (ctx, tx) => {
    await tx
      .update(schema.shipments)
      .set({
        vehicleId: ctx.data.vehicleId!,
        driverId: ctx.data.driverId!,
        updatedAt: ctx.now,
      })
      .where(eq(schema.shipments.id, ctx.shipment.id));

    await tx
      .update(schema.vehicles)
      .set({ status: 'in_transit', currentDriverId: ctx.data.driverId!, updatedAt: ctx.now })
      .where(eq(schema.vehicles.id, ctx.data.vehicleId!));

    await tx
      .update(schema.drivers)
      .set({ status: 'driving', updatedAt: ctx.now })
      .where(eq(schema.drivers.id, ctx.data.driverId!));
  };
}

function revertVehicleAndDriver(): SideEffectFn {
  return async (ctx, tx) => {
    if (ctx.shipment.vehicleId) {
      await tx
        .update(schema.vehicles)
        .set({ status: 'available', currentDriverId: null, updatedAt: ctx.now })
        .where(eq(schema.vehicles.id, ctx.shipment.vehicleId));
    }
    if (ctx.shipment.driverId) {
      await tx
        .update(schema.drivers)
        .set({ status: 'available', updatedAt: ctx.now })
        .where(eq(schema.drivers.id, ctx.shipment.driverId));
    }
  };
}

function setActualPickup(): SideEffectFn {
  return async (ctx, tx) => {
    await tx
      .update(schema.shipments)
      .set({ actualPickup: ctx.now, updatedAt: ctx.now })
      .where(eq(schema.shipments.id, ctx.shipment.id));
  };
}

function setActualDelivery(): SideEffectFn {
  return async (ctx, tx) => {
    const updates: Record<string, unknown> = {
      actualDelivery: ctx.now,
      updatedAt: ctx.now,
    };
    if (ctx.data.podSignature) updates.podSignature = ctx.data.podSignature;
    if (ctx.data.podPhotoUrls) updates.podPhotoUrls = ctx.data.podPhotoUrls;
    if (ctx.data.podNotes) updates.podNotes = ctx.data.podNotes;

    await tx
      .update(schema.shipments)
      .set(updates)
      .where(eq(schema.shipments.id, ctx.shipment.id));
  };
}

function recordFailureReason(): SideEffectFn {
  return async (ctx, tx) => {
    await tx
      .update(schema.shipments)
      .set({ failureReason: ctx.data.failureReason!, updatedAt: ctx.now })
      .where(eq(schema.shipments.id, ctx.shipment.id));
  };
}

function clearFailureReason(): SideEffectFn {
  return async (ctx, tx) => {
    await tx
      .update(schema.shipments)
      .set({ failureReason: null, vehicleId: null, driverId: null, updatedAt: ctx.now })
      .where(eq(schema.shipments.id, ctx.shipment.id));
  };
}

function setCancellationNotes(): SideEffectFn {
  return async (ctx, tx) => {
    await tx
      .update(schema.shipments)
      .set({ notes: ctx.data.cancellationReason!, updatedAt: ctx.now })
      .where(eq(schema.shipments.id, ctx.shipment.id));
  };
}

function triggerWebhook(redis: Redis, event: string): SideEffectFn {
  return async (ctx, _tx) => {
    await redis.lpush(
      `webhook_queue:${ctx.tenantId}`,
      JSON.stringify({ event, shipmentId: ctx.shipment.id, tenantId: ctx.tenantId, timestamp: ctx.now.toISOString() }),
    );
  };
}

// ---------------------------------------------------------------------------
// Transition Map
// ---------------------------------------------------------------------------

function buildTransitionMap(redis: Redis): Map<string, TransitionDef> {
  const map = new Map<string, TransitionDef>();

  map.set('draft:confirmed', {
    guards: [requireFields, maxWeight, tempControlCheck],
    sideEffects: [generateReferenceCode(redis, '')],
  });

  map.set('draft:cancelled', {
    guards: [requireCancellationReason],
    sideEffects: [setCancellationNotes],
  });

  map.set('confirmed:assigned', {
    guards: [requireVehicleAndDriver],
    sideEffects: [checkVehicleCapacityAndAvailability(), checkDriverAvailability(), assignVehicleAndDriver()],
  });

  map.set('confirmed:cancelled', {
    guards: [requireCancellationReason],
    sideEffects: [setCancellationNotes],
  });

  map.set('assigned:picked_up', {
    guards: [validatePickupWindow],
    sideEffects: [setActualPickup()],
  });

  map.set('assigned:cancelled', {
    guards: [requireCancellationReason],
    sideEffects: [revertVehicleAndDriver(), setCancellationNotes],
  });

  map.set('picked_up:in_transit', {
    guards: [],
    sideEffects: [],
  });

  map.set('in_transit:delivered', {
    guards: [requirePOD],
    sideEffects: [setActualDelivery()],
  });

  map.set('in_transit:failed', {
    guards: [requireFailureReason],
    sideEffects: [recordFailureReason(), revertVehicleAndDriver(), triggerWebhook(redis, 'shipment.failed')],
  });

  map.set('delivered:completed', {
    guards: [],
    sideEffects: [triggerWebhook(redis, 'shipment.completed'), revertVehicleAndDriver()],
  });

  map.set('failed:confirmed', {
    guards: [],
    sideEffects: [clearFailureReason()],
  });

  return map;
}

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

export class ShipmentStateMachine {
  private transitionMap: Map<string, TransitionDef>;

  constructor(
    private db: Database,
    private redis: Redis,
  ) {
    this.transitionMap = buildTransitionMap(redis);
  }

  async transition(
    shipmentId: string,
    toStatus: ShipmentStatus,
    data: TransitionData,
    userId: string,
    tenantId: string,
  ): Promise<TransitionResult> {
    const [shipment] = await this.db
      .select()
      .from(schema.shipments)
      .where(
        and(eq(schema.shipments.id, shipmentId), eq(schema.shipments.tenantId, tenantId)),
      );

    if (!shipment) {
      return { success: false, shipmentId, fromStatus: 'draft', toStatus, referenceCode: '', error: 'Shipment not found' };
    }

    const fromStatus = shipment.status as ShipmentStatus;
    const allowed = SHIPMENT_TRANSITIONS[fromStatus];
    if (!allowed?.includes(toStatus)) {
      return {
        success: false,
        shipmentId,
        fromStatus,
        toStatus,
        referenceCode: shipment.referenceCode,
        error: `Transition from '${fromStatus}' to '${toStatus}' is not allowed`,
      };
    }

    const key = `${fromStatus}:${toStatus}`;
    const def = this.transitionMap.get(key);
    if (!def) {
      return {
        success: false,
        shipmentId,
        fromStatus,
        toStatus,
        referenceCode: shipment.referenceCode,
        error: `No transition definition for '${key}'`,
      };
    }

    const now = new Date();
    const ctx: TransitionContext = { shipment, data, userId, tenantId, now };

    for (const guard of def.guards) {
      const err = guard(ctx);
      if (err) {
        return { success: false, shipmentId, fromStatus, toStatus, referenceCode: shipment.referenceCode, error: err };
      }
    }

    try {
      await this.db.transaction(async (tx) => {
        // The generateReferenceCode side-effect needs the tenant-scoped Redis key;
        // patch the closure's tenantId by rebuilding for `draft:confirmed`
        if (key === 'draft:confirmed') {
          def.sideEffects[0] = generateReferenceCode(this.redis, tenantId);
        }

        for (const effect of def.sideEffects) {
          await effect(ctx, tx);
        }

        await tx
          .update(schema.shipments)
          .set({ status: toStatus, updatedAt: now })
          .where(eq(schema.shipments.id, shipmentId));

        await tx.insert(schema.shipmentEvents).values({
          shipmentId,
          status: toStatus,
          previousStatus: fromStatus,
          notes: data.notes ?? null,
          actorId: userId,
          createdAt: now,
        });
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      return { success: false, shipmentId, fromStatus, toStatus, referenceCode: shipment.referenceCode, error: message };
    }

    const updatedRef = ctx.shipment.referenceCode ?? shipment.referenceCode;

    await this.redis.publish(
      `shipment_updates:${tenantId}`,
      JSON.stringify({
        type: 'shipment.status_changed',
        shipmentId,
        fromStatus,
        toStatus,
        referenceCode: updatedRef,
        userId,
        timestamp: now.toISOString(),
      }),
    );

    return { success: true, shipmentId, fromStatus, toStatus, referenceCode: updatedRef };
  }
}
