import type { Job } from 'bullmq';
import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { routes, routeStops } from '../db/schema.js';

interface OptimizeJobData {
  routeId: string;
  tenantId: string;
}

export async function processRouteOptimization(job: Job<OptimizeJobData>) {
  const { routeId, tenantId } = job.data;

  await job.updateProgress(10);

  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)));

  if (!route) {
    throw new Error(`Route ${routeId} not found`);
  }

  const stops = await db
    .select()
    .from(routeStops)
    .where(eq(routeStops.routeId, routeId))
    .orderBy(asc(routeStops.sequenceOrder));

  if (stops.length < 2) {
    await db
      .update(routes)
      .set({ status: 'optimized', updatedAt: new Date() })
      .where(eq(routes.id, routeId));

    return { routeId, stopsOptimized: stops.length, message: 'Too few stops to optimize' };
  }

  await job.updateProgress(30);

  // Nearest-neighbor heuristic using haversine from PostGIS
  const distanceMatrix = await db.execute(sql`
    SELECT
      a.id AS from_id,
      b.id AS to_id,
      ST_DistanceSphere(a.location, b.location) AS distance_m
    FROM route_stops a
    CROSS JOIN route_stops b
    WHERE a.route_id = ${routeId}
      AND b.route_id = ${routeId}
      AND a.id != b.id
      AND a.location IS NOT NULL
      AND b.location IS NOT NULL
    ORDER BY a.id, distance_m
  `);

  await job.updateProgress(60);

  const matrixRows = (distanceMatrix.rows ?? distanceMatrix) as {
    from_id: string;
    to_id: string;
    distance_m: number;
  }[];

  // Build adjacency: for each stop, sorted list of (toId, dist)
  const adj = new Map<string, { toId: string; dist: number }[]>();
  for (const row of matrixRows) {
    if (!adj.has(row.from_id)) adj.set(row.from_id, []);
    adj.get(row.from_id)!.push({ toId: row.to_id, dist: Number(row.distance_m) });
  }

  // Nearest-neighbor starting from first stop
  const visited = new Set<string>();
  const ordered: string[] = [];
  let current = stops[0].id;
  visited.add(current);
  ordered.push(current);

  while (ordered.length < stops.length) {
    const neighbors = adj.get(current) ?? [];
    const next = neighbors.find((n) => !visited.has(n.toId));
    if (!next) break;
    visited.add(next.toId);
    ordered.push(next.toId);
    current = next.toId;
  }

  // Add any unvisited stops
  for (const stop of stops) {
    if (!visited.has(stop.id)) {
      ordered.push(stop.id);
    }
  }

  await job.updateProgress(80);

  // Update sequence orders
  for (let i = 0; i < ordered.length; i++) {
    await db
      .update(routeStops)
      .set({ sequenceOrder: i, updatedAt: new Date() })
      .where(eq(routeStops.id, ordered[i]));
  }

  // Calculate total distance
  let totalDistance = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    const neighbors = adj.get(ordered[i]);
    const edge = neighbors?.find((n) => n.toId === ordered[i + 1]);
    if (edge) totalDistance += edge.dist;
  }

  await db
    .update(routes)
    .set({
      status: 'optimized',
      distanceKm: (totalDistance / 1000).toFixed(2),
      estimatedDurationMin: Math.ceil(totalDistance / 1000 / 40 * 60),
      updatedAt: new Date(),
    })
    .where(eq(routes.id, routeId));

  await job.updateProgress(100);

  return {
    routeId,
    stopsOptimized: ordered.length,
    totalDistanceKm: (totalDistance / 1000).toFixed(2),
    estimatedDurationMin: Math.ceil(totalDistance / 1000 / 40 * 60),
  };
}
