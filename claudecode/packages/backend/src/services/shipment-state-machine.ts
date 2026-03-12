import { eq, and } from 'drizzle-orm';
import { db, sql as rawSql } from '../db/connection.js';
import { shipments, shipmentEvents, vehicles, drivers } from '../db/schema.js';
import { redisPub } from '../db/connection.js';
import { SHIPMENT_TRANSITIONS } from '@nexus-fleet/shared';
import type { ShipmentStatus } from '@nexus-fleet/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransitionContext {
  tenantId: string;
  userId: string;
}

interface GuardResult {
  valid: boolean;
  error?: string;
}

type GuardFn = (
  shipment: any,
  data: Record<string, any>,
  ctx: TransitionContext,
) => Promise<GuardResult>;

type SideEffectFn = (
  tx: any,
  shipment: any,
  data: Record<string, any>,
  ctx: TransitionContext,
) => Promise<void>;

interface TransitionDef {
  action: string;
  from: ShipmentStatus;
  to: ShipmentStatus;
  guards: GuardFn[];
  sideEffects: SideEffectFn[];
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const guardHasVehicleAndDriver: GuardFn = async (shipment, data) => {
  const vehicleId = data.vehicle_id ?? shipment.vehicle_id;
  const driverId = data.driver_id ?? shipment.driver_id;

  if (!vehicleId) {
    return { valid: false, error: 'Vehicle must be assigned before this transition' };
  }
  if (!driverId) {
    return { valid: false, error: 'Driver must be assigned before this transition' };
  }
  return { valid: true };
};

const guardAssignData: GuardFn = async (_shipment, data) => {
  if (!data.vehicle_id || !data.driver_id) {
    return {
      valid: false,
      error: 'vehicle_id and driver_id are required for assignment',
    };
  }
  return { valid: true };
};

const guardVehicleAvailable: GuardFn = async (_shipment, data, ctx) => {
  if (!data.vehicle_id) return { valid: true };

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, data.vehicle_id),
        eq(vehicles.tenant_id, ctx.tenantId),
        eq(vehicles.is_active, true),
      ),
    )
    .limit(1);

  if (!vehicle) {
    return { valid: false, error: 'Vehicle not found' };
  }

  if (vehicle.status === 'decommissioned' || vehicle.status === 'maintenance') {
    return { valid: false, error: `Vehicle is ${vehicle.status} and cannot be assigned` };
  }

  return { valid: true };
};

const guardDriverAvailable: GuardFn = async (_shipment, data, ctx) => {
  if (!data.driver_id) return { valid: true };

  const [driver] = await db
    .select()
    .from(drivers)
    .where(
      and(
        eq(drivers.id, data.driver_id),
        eq(drivers.tenant_id, ctx.tenantId),
        eq(drivers.is_active, true),
      ),
    )
    .limit(1);

  if (!driver) {
    return { valid: false, error: 'Driver not found' };
  }

  // Check license expiry
  if (driver.license_expiry < new Date()) {
    return { valid: false, error: 'Driver license has expired' };
  }

  return { valid: true };
};

const guardNotAlreadyDelivered: GuardFn = async (shipment) => {
  if (shipment.actual_delivery_at) {
    return { valid: false, error: 'Shipment has already been delivered' };
  }
  return { valid: true };
};

const guardHasFailureReason: GuardFn = async (_shipment, data) => {
  if (!data.failure_reason) {
    return { valid: false, error: 'failure_reason is required when failing a shipment' };
  }
  return { valid: true };
};

// ---------------------------------------------------------------------------
// Side Effects
// ---------------------------------------------------------------------------

const sideEffectAssignVehicleAndDriver: SideEffectFn = async (tx, shipment, data, ctx) => {
  await tx
    .update(shipments)
    .set({
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id,
      updated_at: new Date(),
    })
    .where(and(eq(shipments.id, shipment.id), eq(shipments.tenant_id, ctx.tenantId)));
};

const sideEffectSetPickupTime: SideEffectFn = async (tx, shipment, _data, ctx) => {
  await tx
    .update(shipments)
    .set({ actual_pickup_at: new Date(), updated_at: new Date() })
    .where(and(eq(shipments.id, shipment.id), eq(shipments.tenant_id, ctx.tenantId)));
};

const sideEffectSetDeliveryTime: SideEffectFn = async (tx, shipment, _data, ctx) => {
  await tx
    .update(shipments)
    .set({ actual_delivery_at: new Date(), updated_at: new Date() })
    .where(and(eq(shipments.id, shipment.id), eq(shipments.tenant_id, ctx.tenantId)));
};

const sideEffectSetCompletedTime: SideEffectFn = async (tx, shipment, _data, ctx) => {
  await tx
    .update(shipments)
    .set({ completed_at: new Date(), updated_at: new Date() })
    .where(and(eq(shipments.id, shipment.id), eq(shipments.tenant_id, ctx.tenantId)));
};

const sideEffectSetCancelledTime: SideEffectFn = async (tx, shipment, _data, ctx) => {
  await tx
    .update(shipments)
    .set({ cancelled_at: new Date(), updated_at: new Date() })
    .where(and(eq(shipments.id, shipment.id), eq(shipments.tenant_id, ctx.tenantId)));
};

const sideEffectSetFailureReason: SideEffectFn = async (tx, shipment, data, ctx) => {
  await tx
    .update(shipments)
    .set({ failure_reason: data.failure_reason, updated_at: new Date() })
    .where(and(eq(shipments.id, shipment.id), eq(shipments.tenant_id, ctx.tenantId)));
};

const sideEffectUpdateVehicleStatus = (status: string): SideEffectFn => {
  return async (tx, shipment, _data, ctx) => {
    if (shipment.vehicle_id) {
      await tx
        .update(vehicles)
        .set({ status, updated_at: new Date() })
        .where(
          and(eq(vehicles.id, shipment.vehicle_id), eq(vehicles.tenant_id, ctx.tenantId)),
        );
    }
  };
};

const sideEffectUpdateDriverStatus = (status: string): SideEffectFn => {
  return async (tx, shipment, _data, ctx) => {
    if (shipment.driver_id) {
      await tx
        .update(drivers)
        .set({ status, updated_at: new Date() })
        .where(
          and(eq(drivers.id, shipment.driver_id), eq(drivers.tenant_id, ctx.tenantId)),
        );
    }
  };
};

// ---------------------------------------------------------------------------
// Transition Map
// ---------------------------------------------------------------------------

const ACTION_TO_TARGET: Record<string, ShipmentStatus> = {
  confirm: 'confirmed',
  assign: 'assigned',
  pickup: 'picked_up',
  start_transit: 'in_transit',
  deliver: 'delivered',
  fail: 'failed',
  complete: 'completed',
  cancel: 'cancelled',
  retry: 'confirmed',
};

const transitionMap = new Map<string, TransitionDef>();

function registerTransition(def: TransitionDef) {
  transitionMap.set(`${def.from}:${def.action}`, def);
}

// draft -> confirmed
registerTransition({
  action: 'confirm',
  from: 'draft',
  to: 'confirmed',
  guards: [],
  sideEffects: [],
});

// confirmed -> assigned
registerTransition({
  action: 'assign',
  from: 'confirmed',
  to: 'assigned',
  guards: [guardAssignData, guardVehicleAvailable, guardDriverAvailable],
  sideEffects: [sideEffectAssignVehicleAndDriver],
});

// assigned -> picked_up
registerTransition({
  action: 'pickup',
  from: 'assigned',
  to: 'picked_up',
  guards: [guardHasVehicleAndDriver],
  sideEffects: [
    sideEffectSetPickupTime,
    sideEffectUpdateVehicleStatus('in_transit'),
    sideEffectUpdateDriverStatus('driving'),
  ],
});

// picked_up -> in_transit
registerTransition({
  action: 'start_transit',
  from: 'picked_up',
  to: 'in_transit',
  guards: [],
  sideEffects: [],
});

// in_transit -> delivered
registerTransition({
  action: 'deliver',
  from: 'in_transit',
  to: 'delivered',
  guards: [guardNotAlreadyDelivered],
  sideEffects: [
    sideEffectSetDeliveryTime,
    sideEffectUpdateVehicleStatus('available'),
    sideEffectUpdateDriverStatus('available'),
  ],
});

// in_transit -> failed
registerTransition({
  action: 'fail',
  from: 'in_transit',
  to: 'failed',
  guards: [guardHasFailureReason],
  sideEffects: [
    sideEffectSetFailureReason,
    sideEffectUpdateVehicleStatus('available'),
    sideEffectUpdateDriverStatus('available'),
  ],
});

// delivered -> completed
registerTransition({
  action: 'complete',
  from: 'delivered',
  to: 'completed',
  guards: [],
  sideEffects: [sideEffectSetCompletedTime],
});

// draft -> cancelled
registerTransition({
  action: 'cancel',
  from: 'draft',
  to: 'cancelled',
  guards: [],
  sideEffects: [sideEffectSetCancelledTime],
});

// confirmed -> cancelled
registerTransition({
  action: 'cancel',
  from: 'confirmed',
  to: 'cancelled',
  guards: [],
  sideEffects: [sideEffectSetCancelledTime],
});

// assigned -> cancelled
registerTransition({
  action: 'cancel',
  from: 'assigned',
  to: 'cancelled',
  guards: [],
  sideEffects: [sideEffectSetCancelledTime],
});

// failed -> confirmed (retry)
registerTransition({
  action: 'retry',
  from: 'failed',
  to: 'confirmed',
  guards: [],
  sideEffects: [],
});

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

export class ShipmentStateMachine {
  static async transition(
    shipmentId: string,
    action: string,
    data: Record<string, any>,
    ctx: TransitionContext,
  ): Promise<any> {
    // 1. Fetch shipment
    const [shipment] = await db
      .select()
      .from(shipments)
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.tenant_id, ctx.tenantId),
          eq(shipments.is_deleted, false),
        ),
      )
      .limit(1);

    if (!shipment) {
      const err = new Error('Shipment not found') as any;
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const currentStatus = shipment.status as ShipmentStatus;

    // 2. Look up transition definition
    const transitionDef = transitionMap.get(`${currentStatus}:${action}`);
    if (!transitionDef) {
      const targetStatus = ACTION_TO_TARGET[action];
      const transitionKey = targetStatus ? `${currentStatus}:${targetStatus}` : null;
      const isAllowed = transitionKey ? SHIPMENT_TRANSITIONS[transitionKey] : false;

      if (!isAllowed) {
        const err = new Error(
          `Invalid transition: cannot perform '${action}' from '${currentStatus}'`,
        ) as any;
        err.statusCode = 422;
        err.code = 'INVALID_TRANSITION';
        throw err;
      }

      // Transition is valid per constants but not registered - shouldn't happen
      const err = new Error(
        `Transition '${action}' from '${currentStatus}' is not implemented`,
      ) as any;
      err.statusCode = 501;
      err.code = 'NOT_IMPLEMENTED';
      throw err;
    }

    const targetStatus = transitionDef.to;

    // 3. Run all guards
    for (const guard of transitionDef.guards) {
      const result = await guard(shipment, data, ctx);
      if (!result.valid) {
        const err = new Error(result.error ?? 'Guard check failed') as any;
        err.statusCode = 422;
        err.code = 'GUARD_FAILED';
        throw err;
      }
    }

    // 4. Execute transition within a PostgreSQL transaction
    const result = await db.transaction(async (tx) => {
      // Update shipment status
      const [updated] = await tx
        .update(shipments)
        .set({ status: targetStatus, updated_at: new Date() })
        .where(
          and(eq(shipments.id, shipmentId), eq(shipments.tenant_id, ctx.tenantId)),
        )
        .returning();

      // Run side effects
      for (const sideEffect of transitionDef.sideEffects) {
        await sideEffect(tx, { ...shipment, ...data }, data, ctx);
      }

      // 5. Write audit record
      await tx.insert(shipmentEvents).values({
        tenant_id: ctx.tenantId,
        shipment_id: shipmentId,
        from_status: currentStatus,
        to_status: targetStatus,
        action,
        actor_id: ctx.userId,
        data: data ?? {},
      });

      return updated;
    });

    // 6. After commit: publish to Redis for WebSocket fan-out and webhook dispatch
    try {
      await redisPub.publish(
        `shipment_updates:${ctx.tenantId}`,
        JSON.stringify({
          type: 'shipment_transition',
          data: {
            shipment_id: shipmentId,
            from_status: currentStatus,
            to_status: targetStatus,
            action,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    } catch {
      // Non-critical: log but don't fail the transition
    }

    // Auto-trigger start_transit after pickup
    if (action === 'pickup' && targetStatus === 'picked_up') {
      try {
        return await ShipmentStateMachine.transition(
          shipmentId,
          'start_transit',
          {},
          ctx,
        );
      } catch {
        // If auto-transition fails, return the pickup result
      }
    }

    return result;
  }
}
