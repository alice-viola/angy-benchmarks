import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { shipments, shipmentEvents, vehicles, drivers } from '../db/schema.js';
import { VEHICLE_TYPE_LICENSE_MAP } from '@nexusfleet/shared';
import { Redis } from 'ioredis';

// ─── Types ──────────────────────────────────────────────────

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface TransitionContext {
  shipment: typeof shipments.$inferSelect;
  data?: {
    vehicle_id?: string;
    driver_id?: string;
    pod_signature_url?: string;
    pod_photo_urls?: string[];
    failure_reason?: string;
    cancellation_reason?: string;
  };
  tenant_id: string;
  user_id: string;
  tx: TransactionClient;
}

type Guard = (ctx: TransitionContext) => Promise<string | null>; // returns error message or null
type SideEffect = (ctx: TransitionContext) => Promise<Record<string, any>>; // returns fields to update

interface TransitionDef {
  guards: Guard[];
  sideEffects: SideEffect[];
}

// ─── Guards ─────────────────────────────────────────────────

const vehicleAvailable: Guard = async (ctx) => {
  if (!ctx.data?.vehicle_id) return 'vehicle_id is required for assignment';

  const [vehicle] = await ctx.tx
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, ctx.data.vehicle_id), eq(vehicles.tenant_id, ctx.tenant_id)))
    .limit(1);

  if (!vehicle) return 'Vehicle not found';
  if (vehicle.status !== 'available') return `Vehicle status is '${vehicle.status}', must be 'available'`;

  // Store for side effects
  (ctx as any)._vehicle = vehicle;
  return null;
};

const driverAvailable: Guard = async (ctx) => {
  if (!ctx.data?.driver_id) return 'driver_id is required for assignment';

  const [driver] = await ctx.tx
    .select()
    .from(drivers)
    .where(and(eq(drivers.id, ctx.data.driver_id), eq(drivers.tenant_id, ctx.tenant_id)))
    .limit(1);

  if (!driver) return 'Driver not found';
  if (driver.status !== 'available') return `Driver status is '${driver.status}', must be 'available'`;

  (ctx as any)._driver = driver;
  return null;
};

const licenseMatch: Guard = async (ctx) => {
  const vehicle = (ctx as any)._vehicle;
  const driver = (ctx as any)._driver;
  if (!vehicle || !driver) return 'Vehicle and driver must be loaded first';

  const requiredClass = VEHICLE_TYPE_LICENSE_MAP[vehicle.type ?? ''];
  if (requiredClass && !(driver.license_classes ?? []).includes(requiredClass)) {
    return `Driver does not have required license class '${requiredClass}' for vehicle type '${vehicle.type}'`;
  }
  return null;
};

const hoursCheck: Guard = async (ctx) => {
  const driver = (ctx as any)._driver;
  if (!driver) return 'Driver must be loaded first';

  const current = Number(driver.current_driving_hours ?? 0);
  const max = Number(driver.max_driving_hours_day ?? 9);
  if (current >= max) {
    return `Driver has exceeded maximum driving hours (${current}/${max})`;
  }
  return null;
};

const podRequired: Guard = async (ctx) => {
  // Check if POD data exists on shipment or in request data
  const hasPodOnShipment = ctx.shipment.pod_signature_url || (ctx.shipment.pod_photo_urls && ctx.shipment.pod_photo_urls.length > 0);
  const hasPodInData = ctx.data?.pod_signature_url || (ctx.data?.pod_photo_urls && ctx.data.pod_photo_urls.length > 0);

  if (!hasPodOnShipment && !hasPodInData) {
    return 'At least pod_signature_url or one pod_photo_urls entry is required';
  }
  return null;
};

const failureReasonProvided: Guard = async (ctx) => {
  if (!ctx.data?.failure_reason) {
    return 'failure_reason is required when marking shipment as failed';
  }
  return null;
};

// ─── Side Effects ───────────────────────────────────────────

const generateReferenceCode: SideEffect = async (ctx) => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const redisKey = `shipment_seq:${ctx.tenant_id}:${dateStr}`;

  let seq: number;
  try {
    const redis = getRedis();
    if (redis) {
      seq = await redis.incr(redisKey);
      // Set TTL of 48 hours on first creation
      if (seq === 1) {
        await redis.expire(redisKey, 48 * 60 * 60);
      }
    } else {
      throw new Error('Redis unavailable');
    }
  } catch {
    // Fallback: count existing shipments with reference codes for this tenant+date
    const [{ count }] = await ctx.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(shipments)
      .where(
        and(
          eq(shipments.tenant_id, ctx.tenant_id),
          sql`${shipments.reference_code} LIKE ${'SHP-' + dateStr + '-%'}`,
        ),
      );
    seq = count + 1;
  }

  const reference_code = `SHP-${dateStr}-${String(seq).padStart(5, '0')}`;
  return { reference_code };
};

const setCancellationReason: SideEffect = async (ctx) => {
  return { cancellation_reason: ctx.data?.cancellation_reason ?? null };
};

const assignVehicleDriver: SideEffect = async (ctx) => {
  const vehicle_id = ctx.data!.vehicle_id!;
  const driver_id = ctx.data!.driver_id!;

  // Update vehicle
  await ctx.tx
    .update(vehicles)
    .set({ status: 'in_transit', assigned_driver_id: driver_id, updated_at: new Date() })
    .where(eq(vehicles.id, vehicle_id));

  // Update driver
  await ctx.tx
    .update(drivers)
    .set({ status: 'driving', current_vehicle_id: vehicle_id, updated_at: new Date() })
    .where(eq(drivers.id, driver_id));

  return {
    assigned_vehicle_id: vehicle_id,
    assigned_driver_id: driver_id,
  };
};

const setActualPickupAt: SideEffect = async (_ctx) => {
  return { actual_pickup_at: new Date() };
};

const setActualDeliveryAt: SideEffect = async (ctx) => {
  const updates: Record<string, any> = { actual_delivery_at: new Date() };
  if (ctx.data?.pod_signature_url) updates.pod_signature_url = ctx.data.pod_signature_url;
  if (ctx.data?.pod_photo_urls) updates.pod_photo_urls = ctx.data.pod_photo_urls;
  return updates;
};

const setFailureReason: SideEffect = async (ctx) => {
  return { failure_reason: ctx.data?.failure_reason ?? null };
};

const clearFailureReason: SideEffect = async (_ctx) => {
  return { failure_reason: null };
};

// ─── Transition Map ─────────────────────────────────────────

const TRANSITION_MAP: Record<string, TransitionDef> = {
  'draft:confirmed': {
    guards: [],
    sideEffects: [generateReferenceCode],
  },
  'draft:cancelled': {
    guards: [],
    sideEffects: [setCancellationReason],
  },
  'confirmed:assigned': {
    guards: [vehicleAvailable, driverAvailable, licenseMatch, hoursCheck],
    sideEffects: [assignVehicleDriver],
  },
  'confirmed:cancelled': {
    guards: [],
    sideEffects: [setCancellationReason],
  },
  'assigned:picked_up': {
    guards: [],
    sideEffects: [setActualPickupAt],
  },
  'assigned:cancelled': {
    guards: [],
    sideEffects: [setCancellationReason],
  },
  'picked_up:in_transit': {
    guards: [],
    sideEffects: [],
  },
  'in_transit:delivered': {
    guards: [podRequired],
    sideEffects: [setActualDeliveryAt],
  },
  'in_transit:failed': {
    guards: [failureReasonProvided],
    sideEffects: [setFailureReason],
  },
  'delivered:completed': {
    guards: [],
    sideEffects: [],
  },
  'failed:confirmed': {
    guards: [],
    sideEffects: [clearFailureReason],
  },
};

// ─── Redis Helper ───────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  try {
    const url = process.env.REDIS_URL;
    if (!url) return null;
    _redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    _redis.connect().catch(() => {
      _redis = null;
    });
    return _redis;
  } catch {
    return null;
  }
}

// ─── Execute Transition ─────────────────────────────────────

async function executeSingleTransition(
  fromStatus: string,
  toStatus: string,
  ctx: TransitionContext,
): Promise<{ error?: string; guard?: string; updates: Record<string, any> }> {
  const key = `${fromStatus}:${toStatus}`;
  const transition = TRANSITION_MAP[key];

  if (!transition) {
    return {
      error: `Cannot transition from '${fromStatus}' to '${toStatus}'`,
      updates: {},
    };
  }

  // Run guards
  for (const guard of transition.guards) {
    const guardError = await guard(ctx);
    if (guardError) {
      return { error: `Cannot transition from ${fromStatus} to ${toStatus}`, guard: guardError, updates: {} };
    }
  }

  // Run side effects
  let allUpdates: Record<string, any> = {};
  for (const effect of transition.sideEffects) {
    const updates = await effect(ctx);
    allUpdates = { ...allUpdates, ...updates };
  }

  // Update shipment status + side effect fields
  allUpdates.status = toStatus;
  allUpdates.updated_at = new Date();

  await ctx.tx
    .update(shipments)
    .set(allUpdates)
    .where(eq(shipments.id, ctx.shipment.id));

  // Write shipment_events audit record
  await ctx.tx.insert(shipmentEvents).values({
    tenant_id: ctx.tenant_id,
    shipment_id: ctx.shipment.id,
    event_type: `status_change`,
    from_status: fromStatus,
    to_status: toStatus,
    created_by: ctx.user_id,
    metadata: ctx.data ? ctx.data : {},
  });

  return { updates: allUpdates };
}

export async function executeTransition(
  shipmentId: string,
  tenantId: string,
  userId: string,
  fromStatus: string,
  toStatus: string,
  data?: TransitionContext['data'],
  autoChain?: { nextTo: string },
) {
  const result = await db.transaction(async (tx) => {
    // Fetch shipment within transaction for consistency
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(and(eq(shipments.id, shipmentId), eq(shipments.tenant_id, tenantId)))
      .limit(1);

    if (!shipment) {
      return { error: 'Shipment not found', code: 'NOT_FOUND' as const };
    }

    if (shipment.status !== fromStatus) {
      return {
        error: `Cannot transition from ${shipment.status} to ${toStatus}`,
        code: 'TRANSITION_FAILED' as const,
        guard: `Shipment is currently in '${shipment.status}' status, expected '${fromStatus}'`,
      };
    }

    const ctx: TransitionContext = {
      shipment,
      data,
      tenant_id: tenantId,
      user_id: userId,
      tx,
    };

    // Execute primary transition
    const result1 = await executeSingleTransition(fromStatus, toStatus, ctx);
    if (result1.error) {
      return {
        error: result1.error,
        code: 'TRANSITION_FAILED' as const,
        guard: result1.guard,
      };
    }

    // Auto-chain (e.g., picked_up → in_transit)
    if (autoChain) {
      // Update context with new shipment state
      const updatedShipment = { ...shipment, ...result1.updates };
      const chainCtx: TransitionContext = {
        shipment: updatedShipment as typeof shipments.$inferSelect,
        data,
        tenant_id: tenantId,
        user_id: userId,
        tx,
      };

      const result2 = await executeSingleTransition(toStatus, autoChain.nextTo, chainCtx);
      if (result2.error) {
        return {
          error: result2.error,
          code: 'TRANSITION_FAILED' as const,
          guard: result2.guard,
        };
      }
    }

    // Fetch final shipment state
    const [finalShipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1);

    return { shipment: finalShipment, code: null };
  });

  // After commit: publish event to Redis
  if (result.code === null && result.shipment) {
    const finalStatus = result.shipment.status;
    const previousStatus = autoChain ? fromStatus : fromStatus;
    publishShipmentEvent(tenantId, shipmentId, finalStatus!, previousStatus);
  }

  return result;
}

function publishShipmentEvent(
  tenantId: string,
  shipmentId: string,
  status: string,
  previousStatus: string,
) {
  try {
    const redis = getRedis();
    if (!redis) return;
    const event = JSON.stringify({
      type: 'shipment_update',
      data: {
        shipment_id: shipmentId,
        status,
        previous_status: previousStatus,
        updated_at: new Date().toISOString(),
      },
    });
    redis.publish(`shipment_updates:${tenantId}`, event).catch(() => {});
  } catch {
    // Fire and forget
  }
}
