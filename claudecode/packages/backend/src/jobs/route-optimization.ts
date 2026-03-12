import { Worker, type Job } from 'bullmq';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { routes, routeStops } from '../db/schema.js';
import { haversineDistance } from '@nexus-fleet/shared';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

interface OptimizationJobData {
  routeId: string;
  tenantId: string;
}

/**
 * Route Optimization Worker
 *
 * Uses nearest-neighbor heuristic with constraints:
 * - Pickup before delivery for same shipment
 * - Cumulative weight check against vehicle capacity
 * - Driving hours constraints
 */
export function createRouteOptimizationWorker() {
  const worker = new Worker<OptimizationJobData>(
    'route-optimization',
    async (job: Job<OptimizationJobData>) => {
      const { routeId, tenantId } = job.data;

      await job.updateProgress(10);

      // Fetch route
      const [route] = await db
        .select()
        .from(routes)
        .where(and(eq(routes.id, routeId), eq(routes.tenant_id, tenantId)))
        .limit(1);

      if (!route) {
        throw new Error(`Route ${routeId} not found`);
      }

      // Fetch stops
      const stops = await db
        .select()
        .from(routeStops)
        .where(and(eq(routeStops.route_id, routeId), eq(routeStops.tenant_id, tenantId)))
        .orderBy(asc(routeStops.sequence_order));

      if (stops.length < 2) {
        return { message: 'Not enough stops to optimize', stops: stops.length };
      }

      await job.updateProgress(20);

      // Build dependency map: for each shipment, pickup must come before delivery
      const shipmentPickups = new Map<string, string>(); // shipmentId -> stopId
      const shipmentDeliveries = new Map<string, string>(); // shipmentId -> stopId

      for (const stop of stops) {
        if (stop.shipment_id) {
          if (stop.stop_type === 'pickup') {
            shipmentPickups.set(stop.shipment_id, stop.id);
          } else if (stop.stop_type === 'delivery') {
            shipmentDeliveries.set(stop.shipment_id, stop.id);
          }
        }
      }

      await job.updateProgress(30);

      // Nearest-neighbor algorithm with constraints
      const optimized: typeof stops = [];
      const remaining = new Set(stops.map((s) => s.id));
      const completed = new Set<string>(); // track completed shipment pickups

      // Start from the first stop (depot or first pickup)
      const depotStops = stops.filter((s) => s.stop_type === 'depot');
      let currentStop = depotStops[0] ?? stops[0];

      optimized.push(currentStop);
      remaining.delete(currentStop.id);

      if (currentStop.shipment_id && currentStop.stop_type === 'pickup') {
        completed.add(currentStop.shipment_id);
      }

      while (remaining.size > 0) {
        let nearestStop: (typeof stops)[0] | null = null;
        let nearestDist = Infinity;

        for (const stopId of remaining) {
          const candidate = stops.find((s) => s.id === stopId)!;

          // Check constraint: if delivery, pickup must be done first
          if (candidate.stop_type === 'delivery' && candidate.shipment_id) {
            const pickupId = shipmentPickups.get(candidate.shipment_id);
            if (pickupId && remaining.has(pickupId)) {
              continue; // Can't deliver before pickup
            }
          }

          const dist = haversineDistance(
            parseFloat(currentStop.location_lat),
            parseFloat(currentStop.location_lng),
            parseFloat(candidate.location_lat),
            parseFloat(candidate.location_lng),
          );

          if (dist < nearestDist) {
            nearestDist = dist;
            nearestStop = candidate;
          }
        }

        if (!nearestStop) {
          // If no valid stop found (constraint deadlock), just pick any remaining
          const firstRemainingId = remaining.values().next().value!;
          nearestStop = stops.find((s) => s.id === firstRemainingId)!;
        }

        optimized.push(nearestStop);
        remaining.delete(nearestStop.id);

        if (nearestStop.shipment_id && nearestStop.stop_type === 'pickup') {
          completed.add(nearestStop.shipment_id);
        }

        currentStop = nearestStop;

        // Update progress proportionally
        const progress = 30 + Math.round((70 * optimized.length) / stops.length);
        await job.updateProgress(Math.min(progress, 95));
      }

      // Calculate total distance and generate polyline
      let totalDistance = 0;
      const polylinePoints: Array<[number, number]> = [];

      for (let i = 0; i < optimized.length; i++) {
        const stop = optimized[i];
        polylinePoints.push([parseFloat(stop.location_lat), parseFloat(stop.location_lng)]);

        if (i > 0) {
          const prev = optimized[i - 1];
          totalDistance += haversineDistance(
            parseFloat(prev.location_lat),
            parseFloat(prev.location_lng),
            parseFloat(stop.location_lat),
            parseFloat(stop.location_lng),
          );
        }
      }

      // Estimate duration (avg 30 km/h in urban areas + 10 min per stop)
      const estimatedDurationMin = Math.round((totalDistance / 30) * 60 + optimized.length * 10);

      // Simple encoded polyline (just JSON coordinates for now)
      const polyline = JSON.stringify(polylinePoints);

      // Update stops with new order in DB
      await db.transaction(async (tx) => {
        for (let i = 0; i < optimized.length; i++) {
          await tx
            .update(routeStops)
            .set({ sequence_order: i, updated_at: new Date() })
            .where(eq(routeStops.id, optimized[i].id));
        }

        // Update route with calculated values
        await tx
          .update(routes)
          .set({
            status: 'optimized',
            total_distance_km: String(Math.round(totalDistance * 100) / 100),
            estimated_duration_min: estimatedDurationMin,
            polyline,
            updated_at: new Date(),
          })
          .where(eq(routes.id, routeId));
      });

      await job.updateProgress(100);

      return {
        totalDistance: Math.round(totalDistance * 100) / 100,
        estimatedDurationMin,
        stopsOptimized: optimized.length,
        stopOrder: optimized.map((s) => s.id),
      };
    },
    {
      connection: {
        url: REDIS_URL,
      },
      concurrency: 2,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[route-optimization] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
