import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { eq, and, sql, asc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { routes, routeStops, vehicles } from '../db/schema.js';
import { optimizeRoute } from '../services/route-optimizer.js';
import { QUEUE_NAMES } from './queue-setup.js';

interface OptimizeJobData {
  route_id: string;
  tenant_id: string;
}

export async function processRouteOptimization(job: Job<OptimizeJobData>) {
  const { route_id, tenant_id } = job.data;

  await job.updateProgress(10);

  const [route] = await db
    .select({
      id: routes.id,
      vehicle_capacity_kg: vehicles.capacity_kg,
    })
    .from(routes)
    .leftJoin(vehicles, eq(routes.vehicle_id, vehicles.id))
    .where(and(eq(routes.id, route_id), eq(routes.tenant_id, tenant_id)))
    .limit(1);

  if (!route) throw new Error(`Route ${route_id} not found`);

  const stops = await db
    .select({
      id: routeStops.id,
      shipment_id: routeStops.shipment_id,
      stop_type: routeStops.stop_type,
      sequence_order: routeStops.sequence_order,
      lat: sql<number | null>`CASE WHEN ${routeStops.location} IS NOT NULL THEN ST_Y(${routeStops.location}::geometry) ELSE NULL END`,
      lng: sql<number | null>`CASE WHEN ${routeStops.location} IS NOT NULL THEN ST_X(${routeStops.location}::geometry) ELSE NULL END`,
    })
    .from(routeStops)
    .where(eq(routeStops.route_id, route_id))
    .orderBy(asc(routeStops.sequence_order));

  const formattedStops = stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      id: s.id,
      shipment_id: s.shipment_id,
      stop_type: s.stop_type,
      sequence_order: s.sequence_order,
      location: { lat: Number(s.lat), lng: Number(s.lng) },
    }));

  const result = optimizeRoute({
    stops: formattedStops,
    vehicle_capacity_kg: route.vehicle_capacity_kg ? Number(route.vehicle_capacity_kg) : 10000,
    max_driving_hours: 9,
  });

  for (const stop of result.stops) {
    await db
      .update(routeStops)
      .set({ sequence_order: stop.sequence_order })
      .where(eq(routeStops.id, stop.id));
  }

  await db
    .update(routes)
    .set({
      estimated_distance_km: String(result.estimated_distance_km),
      optimization_score: String(result.optimization_score),
      updated_at: new Date(),
    })
    .where(eq(routes.id, route_id));

  await job.updateProgress(100);
  return result;
}

export function createRouteOptimizationWorker() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker(QUEUE_NAMES.ROUTE_OPTIMIZATION, processRouteOptimization, {
    connection: connection as any,
    concurrency: 3,
  });
}
