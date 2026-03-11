import { eq, and, count, desc, asc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { routes, routeStops, shipments } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { ServiceError } from './vehicle.service.js';
import * as shipmentStateMachine from './shipment-state-machine.js';

interface ListParams {
  tenantId: string;
  status?: string;
  page: number;
  limit: number;
}

export async function list(params: ListParams) {
  const { tenantId, page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(routes.tenant_id, tenantId)];
  if (params.status) {
    conditions.push(eq(routes.status, params.status as any));
  }
  const where = and(...conditions);

  const [items, [total]] = await Promise.all([
    db.select().from(routes).where(where).orderBy(desc(routes.created_at)).limit(limit).offset(offset),
    db.select({ count: count() }).from(routes).where(where),
  ]);

  return {
    data: items,
    meta: { totalItems: total.count, page, pageSize: limit, totalPages: Math.ceil(total.count / limit) },
  };
}

export async function getById(tenantId: string, id: string) {
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)))
    .limit(1);
  if (!route) throw new ServiceError('Route not found', 404, 'NOT_FOUND');

  const stops = await db
    .select()
    .from(routeStops)
    .where(eq(routeStops.route_id, id))
    .orderBy(asc(routeStops.sequence_order));

  return { ...route, stops };
}

export async function create(tenantId: string, data: any) {
  const result = await db.transaction(async (tx) => {
    const [route] = await tx
      .insert(routes)
      .values({
        tenant_id: tenantId,
        name: data.name,
        vehicle_id: data.vehicle_id || null,
        driver_id: data.driver_id || null,
      })
      .returning();

    if (data.waypoints?.length) {
      await tx.insert(routeStops).values(
        data.waypoints.map((wp: any, i: number) => ({
          route_id: route.id,
          stop_type: 'depot' as const,
          sequence_order: wp.order ?? i,
          address: wp.address || `Waypoint ${i + 1}`,
          lat: wp.latitude.toString(),
          lng: wp.longitude.toString(),
        })),
      );
    }

    return route;
  });

  return result;
}

export async function update(tenantId: string, id: string, data: any) {
  const existing = await getById(tenantId, id);

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.vehicle_id !== undefined) updateData.vehicle_id = data.vehicle_id;
  if (data.driver_id !== undefined) updateData.driver_id = data.driver_id;

  if (Object.keys(updateData).length === 0) return existing;

  const [route] = await db
    .update(routes)
    .set(updateData)
    .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)))
    .returning();

  return route;
}

export async function softDelete(tenantId: string, id: string) {
  const route = await getById(tenantId, id);
  if (route.status !== 'draft') {
    throw new ServiceError('Can only delete routes in draft status', 409, 'NOT_DRAFT');
  }

  await db.delete(routes).where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)));
  return { deleted: true };
}

export async function updateStops(tenantId: string, routeId: string, stops: { id: string; sequence_order: number }[]) {
  const route = await getById(tenantId, routeId);

  // Validate all stop IDs belong to this route
  const existingStops = await db
    .select({ id: routeStops.id })
    .from(routeStops)
    .where(eq(routeStops.route_id, routeId));

  const existingIds = new Set(existingStops.map((s) => s.id));
  for (const stop of stops) {
    if (!existingIds.has(stop.id)) {
      throw new ServiceError(`Stop ${stop.id} does not belong to route ${routeId}`, 400, 'INVALID_STOP');
    }
  }

  await db.transaction(async (tx) => {
    for (const stop of stops) {
      await tx
        .update(routeStops)
        .set({ sequence_order: stop.sequence_order })
        .where(eq(routeStops.id, stop.id));
    }
  });

  return getById(tenantId, routeId);
}

export async function completeStop(
  tenantId: string,
  routeId: string,
  stopId: string,
  data: any,
  context: { userId: string; tenantId: string },
) {
  const route = await getById(tenantId, routeId);

  const [stop] = await db
    .select()
    .from(routeStops)
    .where(and(eq(routeStops.id, stopId), eq(routeStops.route_id, routeId)))
    .limit(1);

  if (!stop) throw new ServiceError('Stop not found', 404, 'NOT_FOUND');

  const result = await db.transaction(async (tx) => {
    await tx
      .update(routeStops)
      .set({
        status: 'completed',
        completed_at: new Date(),
        actual_arrival: new Date(),
        pod_signature_url: data.pod_signature_url || null,
        pod_photo_urls: data.pod_photo_urls || null,
        pod_notes: data.pod_notes || null,
      })
      .where(eq(routeStops.id, stopId));

    // If delivery stop with linked shipment, trigger deliver transition
    if (stop.stop_type === 'delivery' && stop.shipment_id) {
      await shipmentStateMachine.transition(
        stop.shipment_id,
        'deliver',
        {
          pod_signature_url: data.pod_signature_url,
          pod_photo_urls: data.pod_photo_urls,
          pod_notes: data.pod_notes,
        },
        context,
      );
    }

    const [updated] = await tx
      .select()
      .from(routeStops)
      .where(eq(routeStops.id, stopId))
      .limit(1);

    return updated;
  });

  return result;
}

export async function optimize(tenantId: string, routeId: string) {
  const route = await getById(tenantId, routeId);

  if (route.stops.length < 2) {
    throw new ServiceError('Route must have at least 2 stops', 400, 'INSUFFICIENT_STOPS');
  }

  if (!route.vehicle_id) {
    throw new ServiceError('Route must have a vehicle assigned', 400, 'NO_VEHICLE');
  }

  const { routeOptimizationQueue } = await import('../jobs/queue.js');
  const job = await routeOptimizationQueue.add(
    'optimize-route',
    { route_id: routeId, tenant_id: tenantId },
    { removeOnComplete: 100, removeOnFail: 50 },
  );

  const jobId = job.id ?? `opt-${routeId}-${Date.now()}`;
  await redis.set(`job:${jobId}:state`, 'waiting', 'EX', 3600);

  return { job_id: jobId };
}

export async function getOptimizationJob(jobId: string) {
  const { routeOptimizationQueue } = await import('../jobs/queue.js');
  const job = await routeOptimizationQueue.getJob(jobId);
  if (job) {
    const state = await job.getState();
    return { job_id: jobId, status: state, progress: job.progress };
  }
  const state = await redis.get(`job:${jobId}:state`);
  return { job_id: jobId, status: state || 'unknown' };
}
