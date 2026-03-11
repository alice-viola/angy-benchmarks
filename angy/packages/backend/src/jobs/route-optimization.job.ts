import type { Job } from 'bullmq';
import { eq, and, asc, inArray, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { routes, routeStops, vehicles, shipments } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { haversineDistance } from '@nexus-fleet/shared';

interface OptimizationInput {
  route_id: string;
  tenant_id: string;
}

interface Stop {
  id: string;
  stop_type: string;
  sequence_order: number;
  lat: number;
  lng: number;
  shipment_id: string | null;
  weight_kg: number;
}

export async function processRouteOptimization(job: Job<OptimizationInput>): Promise<void> {
  const { route_id, tenant_id } = job.data;

  await job.updateProgress(10);

  // Load route with vehicle
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.id, route_id), eq(routes.tenant_id, tenant_id)))
    .limit(1);

  if (!route || !route.vehicle_id) return;

  // Load vehicle for capacity
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, route.vehicle_id))
    .limit(1);

  if (!vehicle) return;

  const capacityKg = vehicle.capacity_kg ? Number(vehicle.capacity_kg) : Infinity;

  // Load stops
  const rawStops = await db
    .select()
    .from(routeStops)
    .where(eq(routeStops.route_id, route_id))
    .orderBy(asc(routeStops.sequence_order));

  if (rawStops.length < 2) return;

  // Load shipment weights for capacity checks
  const shipmentIds = rawStops
    .map((s) => s.shipment_id)
    .filter((id): id is string => id !== null);

  const shipmentWeights = new Map<string, number>();
  if (shipmentIds.length > 0) {
    const shipmentRows = await db
      .select({ id: shipments.id, cargo_weight_kg: shipments.cargo_weight_kg })
      .from(shipments)
      .where(inArray(shipments.id, shipmentIds));
    for (const row of shipmentRows) {
      shipmentWeights.set(row.id, row.cargo_weight_kg ? Number(row.cargo_weight_kg) : 0);
    }
  }

  await job.updateProgress(30);

  const stops: Stop[] = rawStops.map((s) => ({
    id: s.id,
    stop_type: s.stop_type,
    sequence_order: s.sequence_order,
    lat: Number(s.lat),
    lng: Number(s.lng),
    shipment_id: s.shipment_id,
    weight_kg: s.shipment_id ? (shipmentWeights.get(s.shipment_id) ?? 0) : 0,
  }));

  // Build pickup-before-delivery precedence constraints
  // For each shipment, pickup index must come before delivery index
  const shipmentPickupIndex = new Map<string, number>();
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].stop_type === 'pickup' && stops[i].shipment_id) {
      shipmentPickupIndex.set(stops[i].shipment_id!, i);
    }
  }

  // Nearest-neighbor heuristic with precedence constraints
  const optimized: Stop[] = [];
  const visited = new Set<number>();
  let currentLat = stops[0].lat;
  let currentLng = stops[0].lng;
  let cumulativeWeight = 0;
  const AVG_SPEED_KMH = 60;
  const maxDrivingHours = 9;
  let totalDistanceKm = 0;

  // Start from first stop (depot or first waypoint)
  optimized.push(stops[0]);
  visited.add(0);

  while (visited.size < stops.length) {
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < stops.length; i++) {
      if (visited.has(i)) continue;

      const stop = stops[i];

      // Check precedence: if this is a delivery, its pickup must already be visited
      if (stop.stop_type === 'delivery' && stop.shipment_id) {
        const pickupIdx = shipmentPickupIndex.get(stop.shipment_id);
        if (pickupIdx !== undefined && !visited.has(pickupIdx)) continue;
      }

      // Check capacity constraint: pickup adds weight, must not exceed vehicle capacity
      if (stop.stop_type === 'pickup') {
        if (cumulativeWeight + stop.weight_kg > capacityKg) continue;
      }

      // Check driving hours constraint
      const dist = haversineDistance(currentLat, currentLng, stop.lat, stop.lng);
      const projectedTotalDist = totalDistanceKm + dist;
      const projectedHours = projectedTotalDist / AVG_SPEED_KMH;
      if (projectedHours > maxDrivingHours) continue;

      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) {
      // Cannot reach any remaining stops within constraints; add remaining in original order
      for (let i = 0; i < stops.length; i++) {
        if (!visited.has(i)) {
          optimized.push(stops[i]);
          visited.add(i);
        }
      }
      break;
    }

    visited.add(bestIdx);
    optimized.push(stops[bestIdx]);
    totalDistanceKm += bestDist;
    currentLat = stops[bestIdx].lat;
    currentLng = stops[bestIdx].lng;

    // Update cumulative weight
    if (stops[bestIdx].stop_type === 'pickup') {
      cumulativeWeight += stops[bestIdx].weight_kg;
    } else if (stops[bestIdx].stop_type === 'delivery') {
      cumulativeWeight -= stops[bestIdx].weight_kg;
    }
  }

  await job.updateProgress(60);

  // Calculate naive distance (original order)
  let naiveDistance = 0;
  for (let i = 1; i < stops.length; i++) {
    naiveDistance += haversineDistance(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng);
  }

  // Recalculate optimized distance
  let optimizedDistance = 0;
  for (let i = 1; i < optimized.length; i++) {
    optimizedDistance += haversineDistance(
      optimized[i - 1].lat,
      optimized[i - 1].lng,
      optimized[i].lat,
      optimized[i].lng,
    );
  }

  const optimizationScore = naiveDistance > 0
    ? Math.min(100, Math.round((1 - optimizedDistance / naiveDistance) * 100 + 50))
    : 50;

  await job.updateProgress(80);

  // Generate PostGIS LineString from ordered stop coordinates
  const lineStringCoords = optimized.map((s) => `${s.lng} ${s.lat}`).join(',');
  const lineStringWkt = `LINESTRING(${lineStringCoords})`;

  // Update route and stops in DB
  await db.transaction(async (tx) => {
    // Update stop sequence orders
    for (let i = 0; i < optimized.length; i++) {
      await tx
        .update(routeStops)
        .set({ sequence_order: i })
        .where(eq(routeStops.id, optimized[i].id));
    }

    // Update route
    await tx
      .update(routes)
      .set({
        status: 'optimized',
        estimated_distance_km: optimizedDistance.toFixed(2),
        optimization_score: Math.max(0, Math.min(100, optimizationScore)).toString(),
        polyline: sql`ST_GeomFromText(${lineStringWkt}, 4326)`,
      })
      .where(eq(routes.id, route_id));
  });

  await job.updateProgress(90);

  // Update job state in Redis
  await redis.set(`job:${job.id}:state`, 'completed', 'EX', 3600);

  // Publish to shipment_updates channel
  await redis.publish(
    `shipment_updates:${tenant_id}`,
    JSON.stringify({
      event: 'route_optimized',
      route_id,
      status: 'completed',
      estimated_distance_km: Number(optimizedDistance.toFixed(2)),
      optimization_score: Math.max(0, Math.min(100, optimizationScore)),
    }),
  );

  await job.updateProgress(100);
}
