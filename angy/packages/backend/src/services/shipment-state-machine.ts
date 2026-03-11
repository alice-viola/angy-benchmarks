import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { shipments, shipmentEvents, vehicles, drivers } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { VEHICLE_LICENSE_REQUIREMENTS } from '@nexus-fleet/shared';
import * as hosService from './hos.service.js';
import { ServiceError } from './vehicle.service.js';
import type { ShipmentAction, ShipmentState } from '@nexus-fleet/shared';

// ── Transition map ──────────────────────────────────────────────────────────

const TRANSITIONS = new Set([
  'draft:confirmed',
  'draft:cancelled',
  'confirmed:assigned',
  'confirmed:cancelled',
  'assigned:picked_up',
  'assigned:cancelled',
  'picked_up:in_transit',
  'in_transit:delivered',
  'in_transit:failed',
  'delivered:completed',
  'failed:confirmed',
]);

const ACTION_TARGET: Record<string, ShipmentState> = {
  confirm: 'confirmed',
  assign: 'assigned',
  pickup: 'picked_up',
  deliver: 'delivered',
  fail: 'failed',
  complete: 'completed',
  cancel: 'cancelled',
};

// ── Guards ──────────────────────────────────────────────────────────────────

type Guard = (shipment: any, data: any, context: any) => Promise<void> | void;

const guards: Record<string, Guard[]> = {
  'draft:confirmed': [
    async (shipment) => {
      if (!shipment.customer_name) throw guardError('confirm-from-draft', 'customer_name is required');
      if (!shipment.origin_address) throw guardError('confirm-from-draft', 'origin_address is required');
      if (!shipment.dest_address) throw guardError('confirm-from-draft', 'dest_address is required');
      if (!shipment.origin_lat || !shipment.origin_lng) throw guardError('confirm-from-draft', 'origin coordinates required');
      if (!shipment.dest_lat || !shipment.dest_lng) throw guardError('confirm-from-draft', 'destination coordinates required');
      if (shipment.cargo_weight_kg && parseFloat(shipment.cargo_weight_kg) > 50000) {
        throw guardError('confirm-from-draft', 'cargo_weight_kg exceeds 50000 limit');
      }
      if (shipment.requires_temp_control) {
        if (shipment.temp_min_c == null || shipment.temp_max_c == null) {
          throw guardError('confirm-from-draft', 'temp_min_c and temp_max_c required when requires_temp_control is true');
        }
      }
    },
  ],
  'failed:confirmed': [],
  'confirmed:assigned': [
    async (shipment, data) => {
      if (!data.vehicle_id) throw guardError('assign', 'vehicle_id is required');
      if (!data.driver_id) throw guardError('assign', 'driver_id is required');

      const [vehicle] = await db
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.id, data.vehicle_id), eq(vehicles.tenant_id, shipment.tenant_id)))
        .limit(1);
      if (!vehicle) throw guardError('assign', 'Vehicle not found');

      const [driver] = await db
        .select()
        .from(drivers)
        .where(and(eq(drivers.id, data.driver_id), eq(drivers.tenant_id, shipment.tenant_id)))
        .limit(1);
      if (!driver) throw guardError('assign', 'Driver not found');

      // Capacity checks
      if (shipment.cargo_weight_kg && vehicle.capacity_kg && parseFloat(shipment.cargo_weight_kg) > parseFloat(vehicle.capacity_kg)) {
        throw guardError('assign', `Vehicle capacity_kg (${vehicle.capacity_kg}) insufficient for cargo (${shipment.cargo_weight_kg})`);
      }
      if (shipment.cargo_volume_m3 && vehicle.capacity_m3 && parseFloat(shipment.cargo_volume_m3) > parseFloat(vehicle.capacity_m3)) {
        throw guardError('assign', `Vehicle capacity_m3 (${vehicle.capacity_m3}) insufficient for cargo (${shipment.cargo_volume_m3})`);
      }

      // Vehicle must be available
      if (vehicle.status !== 'available') {
        throw guardError('assign', `Vehicle status is ${vehicle.status}, must be available`);
      }

      // Driver must be available
      if (driver.status !== 'available') {
        throw guardError('assign', `Driver status is ${driver.status}, must be available`);
      }

      // Perishable cargo needs refrigerated vehicle
      if (shipment.cargo_type === 'perishable' && vehicle.type !== 'refrigerated') {
        throw guardError('assign', 'Perishable cargo requires a refrigerated vehicle');
      }

      // License class check
      const requiredClass = VEHICLE_LICENSE_REQUIREMENTS[vehicle.type as keyof typeof VEHICLE_LICENSE_REQUIREMENTS];
      if (requiredClass && !driver.license_classes.includes(requiredClass)) {
        throw guardError('assign', `Driver lacks required license class ${requiredClass}`);
      }

      // License expiry check
      if (new Date(driver.license_expiry) < new Date()) {
        throw guardError('assign', 'Driver license has expired');
      }

      // HoS check
      const hours = await hosService.checkHoursAvailable(driver.id);
      if (!hours.available) {
        throw guardError('assign', `Driver has exceeded maximum driving hours (${hours.current}/${hours.max})`);
      }
    },
  ],
  'assigned:picked_up': [
    (shipment) => {
      if (shipment.scheduled_pickup_at) {
        const scheduled = new Date(shipment.scheduled_pickup_at).getTime();
        const now = Date.now();
        const twoHoursMs = 2 * 60 * 60 * 1000;
        if (Math.abs(now - scheduled) > twoHoursMs) {
          throw guardError('pickup', 'Pickup must be within 2 hours of scheduled_pickup_at');
        }
      }
    },
  ],
  'picked_up:in_transit': [],
  'in_transit:delivered': [
    (shipment, data) => {
      if (!data.pod_signature_url && (!data.pod_photo_urls || !Array.isArray(data.pod_photo_urls) || data.pod_photo_urls.length === 0)) {
        throw guardError('deliver', 'pod_signature_url or non-empty pod_photo_urls required');
      }
    },
  ],
  'in_transit:failed': [
    (_shipment, data) => {
      if (!data.failure_reason) throw guardError('fail', 'failure_reason is required');
    },
  ],
  'draft:cancelled': [
    (_shipment, data) => {
      if (!data.cancellation_reason) throw guardError('cancel', 'cancellation_reason is required');
    },
  ],
  'confirmed:cancelled': [
    (_shipment, data) => {
      if (!data.cancellation_reason) throw guardError('cancel', 'cancellation_reason is required');
    },
  ],
  'assigned:cancelled': [
    (_shipment, data) => {
      if (!data.cancellation_reason) throw guardError('cancel', 'cancellation_reason is required');
    },
  ],
  'delivered:completed': [],
};

function guardError(guard: string, reason: string) {
  return new ServiceError(`Guard [${guard}]: ${reason}`, 409, 'GUARD_FAILED');
}

// ── Side effects ────────────────────────────────────────────────────────────

type SideEffect = (shipment: any, data: any, context: any, tx: any) => Promise<any>;

const sideEffects: Record<string, SideEffect[]> = {
  'draft:confirmed': [
    async (shipment, _data, _ctx, tx) => {
      // Generate reference_code via Redis INCR
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const seqKey = `shipment_seq:${shipment.tenant_id}:${dateStr}`;
      const seq = await redis.incr(seqKey);
      await redis.expire(seqKey, 86400 * 2); // TTL 2 days
      const referenceCode = `SHP-${dateStr}-${String(seq).padStart(5, '0')}`;

      await tx
        .update(shipments)
        .set({ reference_code: referenceCode })
        .where(eq(shipments.id, shipment.id));

      return { reference_code: referenceCode };
    },
  ],
  'failed:confirmed': [
    async (shipment, _data, _ctx, tx) => {
      await tx
        .update(shipments)
        .set({ failure_reason: null })
        .where(eq(shipments.id, shipment.id));
    },
  ],
  'confirmed:assigned': [
    async (shipment, data, _ctx, tx) => {
      await tx
        .update(shipments)
        .set({
          assigned_vehicle_id: data.vehicle_id,
          assigned_driver_id: data.driver_id,
        })
        .where(eq(shipments.id, shipment.id));

      await tx
        .update(vehicles)
        .set({ status: 'in_transit' })
        .where(eq(vehicles.id, data.vehicle_id));

      await tx
        .update(drivers)
        .set({ status: 'driving' })
        .where(eq(drivers.id, data.driver_id));

      await hosService.startDriving(data.driver_id);
    },
  ],
  'assigned:picked_up': [
    async (shipment, _data, _ctx, tx) => {
      await tx
        .update(shipments)
        .set({ actual_pickup_at: new Date() })
        .where(eq(shipments.id, shipment.id));
    },
  ],
  'in_transit:delivered': [
    async (shipment, data, _ctx, tx) => {
      const updateData: any = { actual_delivery_at: new Date() };
      if (data.pod_signature_url) updateData.pod_signature_url = data.pod_signature_url;
      if (data.pod_photo_urls) updateData.pod_photo_urls = data.pod_photo_urls;
      if (data.pod_notes) updateData.pod_notes = data.pod_notes;

      await tx
        .update(shipments)
        .set(updateData)
        .where(eq(shipments.id, shipment.id));
    },
  ],
  'in_transit:failed': [
    async (shipment, data, _ctx, tx) => {
      await tx
        .update(shipments)
        .set({ failure_reason: data.failure_reason })
        .where(eq(shipments.id, shipment.id));

      // Revert vehicle + driver
      if (shipment.assigned_vehicle_id) {
        await tx
          .update(vehicles)
          .set({ status: 'available' })
          .where(eq(vehicles.id, shipment.assigned_vehicle_id));
      }
      if (shipment.assigned_driver_id) {
        await tx
          .update(drivers)
          .set({ status: 'available' })
          .where(eq(drivers.id, shipment.assigned_driver_id));
        await hosService.stopDriving(shipment.assigned_driver_id);
      }

      // Enqueue webhook (fire-and-forget)
      try {
        await redis.lpush(
          'webhook_jobs',
          JSON.stringify({
            event: 'shipment.failed',
            tenant_id: shipment.tenant_id,
            shipment_id: shipment.id,
          }),
        );
      } catch { /* non-critical */ }
    },
  ],
  'delivered:completed': [
    async (shipment, _data, _ctx, tx) => {
      if (shipment.assigned_vehicle_id) {
        await tx
          .update(vehicles)
          .set({ status: 'available' })
          .where(eq(vehicles.id, shipment.assigned_vehicle_id));
      }
      if (shipment.assigned_driver_id) {
        await tx
          .update(drivers)
          .set({ status: 'available' })
          .where(eq(drivers.id, shipment.assigned_driver_id));
        await hosService.stopDriving(shipment.assigned_driver_id);
      }

      try {
        await redis.lpush(
          'webhook_jobs',
          JSON.stringify({
            event: 'shipment.completed',
            tenant_id: shipment.tenant_id,
            shipment_id: shipment.id,
          }),
        );
      } catch { /* non-critical */ }
    },
  ],
  'assigned:cancelled': [
    async (shipment, data, _ctx, tx) => {
      const updateData: any = { cancellation_reason: data.cancellation_reason };
      // Revert vehicle + driver
      if (shipment.assigned_vehicle_id) {
        await tx
          .update(vehicles)
          .set({ status: 'available' })
          .where(eq(vehicles.id, shipment.assigned_vehicle_id));
        updateData.assigned_vehicle_id = null;
      }
      if (shipment.assigned_driver_id) {
        await tx
          .update(drivers)
          .set({ status: 'available' })
          .where(eq(drivers.id, shipment.assigned_driver_id));
        await hosService.stopDriving(shipment.assigned_driver_id);
        updateData.assigned_driver_id = null;
      }

      await tx
        .update(shipments)
        .set(updateData)
        .where(eq(shipments.id, shipment.id));
    },
  ],
  'draft:cancelled': [
    async (shipment, data, _ctx, tx) => {
      await tx
        .update(shipments)
        .set({ cancellation_reason: data.cancellation_reason })
        .where(eq(shipments.id, shipment.id));
    },
  ],
  'confirmed:cancelled': [
    async (shipment, data, _ctx, tx) => {
      await tx
        .update(shipments)
        .set({ cancellation_reason: data.cancellation_reason })
        .where(eq(shipments.id, shipment.id));
    },
  ],
};

// ── Main transition function ────────────────────────────────────────────────

interface TransitionContext {
  userId: string;
  tenantId: string;
}

export async function transition(
  shipmentId: string,
  action: string,
  data: any,
  context: TransitionContext,
) {
  const target = ACTION_TARGET[action];
  if (!target) {
    throw new ServiceError(`Unknown action: ${action}`, 400, 'INVALID_ACTION');
  }

  const result = await db.transaction(async (tx) => {
    // Load shipment with FOR UPDATE lock
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(and(eq(shipments.id, shipmentId), eq(shipments.tenant_id, context.tenantId)))
      .for('update')
      .limit(1);

    if (!shipment) {
      throw new ServiceError('Shipment not found', 404, 'NOT_FOUND');
    }

    const from = shipment.status as ShipmentState;
    const transitionKey = `${from}:${target}`;

    if (!TRANSITIONS.has(transitionKey)) {
      throw new ServiceError(
        `Invalid transition: ${from} → ${target} (action: ${action})`,
        409,
        'INVALID_TRANSITION',
      );
    }

    // Run guards
    const guardList = guards[transitionKey] || [];
    for (const guard of guardList) {
      await guard(shipment, data, context);
    }

    // Run side effects
    const effectList = sideEffects[transitionKey] || [];
    let sideEffectResult: any = {};
    for (const effect of effectList) {
      const r = await effect(shipment, data, context, tx);
      if (r) sideEffectResult = { ...sideEffectResult, ...r };
    }

    // Update status
    await tx
      .update(shipments)
      .set({ status: target })
      .where(eq(shipments.id, shipmentId));

    // Insert shipment event
    await tx.insert(shipmentEvents).values({
      tenant_id: context.tenantId,
      shipment_id: shipmentId,
      from_status: from,
      to_status: target,
      event_type: action,
      performed_by: context.userId,
      notes: data.notes || null,
    });

    // Special pickup behavior: auto-transition to in_transit
    if (action === 'pickup') {
      await tx
        .update(shipments)
        .set({ status: 'in_transit' })
        .where(eq(shipments.id, shipmentId));

      await tx.insert(shipmentEvents).values({
        tenant_id: context.tenantId,
        shipment_id: shipmentId,
        from_status: 'picked_up',
        to_status: 'in_transit',
        event_type: 'auto_transition',
        performed_by: context.userId,
        notes: 'Automatic transition from picked_up to in_transit',
      });
    }

    // Re-fetch the final shipment state
    const [updated] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1);

    return { ...updated, ...sideEffectResult };
  });

  // After commit: publish Redis event
  try {
    const eventPayload = JSON.stringify({
      event: 'shipment_status_changed',
      shipment_id: shipmentId,
      action,
      status: result.status,
    });
    await redis.publish(`shipment_updates:${context.tenantId}`, eventPayload);

    // Enqueue webhook job for all transitions
    await redis.lpush(
      'webhook_jobs',
      JSON.stringify({
        event: 'shipment.status_changed',
        tenant_id: context.tenantId,
        shipment_id: shipmentId,
        action,
        status: result.status,
      }),
    );

    // For pickup, emit two events
    if (action === 'pickup') {
      await redis.publish(
        `shipment_updates:${context.tenantId}`,
        JSON.stringify({
          event: 'shipment_status_changed',
          shipment_id: shipmentId,
          action: 'auto_transition',
          status: 'in_transit',
        }),
      );
    }
  } catch {
    // Non-critical
  }

  return result;
}
