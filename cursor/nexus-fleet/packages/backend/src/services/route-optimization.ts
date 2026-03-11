import { eq, and, asc, sql } from 'drizzle-orm';
import type { Database } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { haversineDistance } from '@nexus-fleet/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StopCoord {
  id: string;
  sequenceOrder: number;
  type: string;
  shipmentId: string | null;
  lat: number;
  lng: number;
  address: string;
}

export interface OptimizationResult {
  routeId: string;
  totalDistanceKm: number;
  estimatedDurationMin: number;
  stopsReordered: number;
  score: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const AVG_SPEED_KMH = 60;

export class RouteOptimizationService {
  constructor(private db: Database) {}

  async optimizeRoute(routeId: string, tenantId: string): Promise<OptimizationResult> {
    const [route] = await this.db
      .select()
      .from(schema.routes)
      .where(and(eq(schema.routes.id, routeId), eq(schema.routes.tenantId, tenantId)));

    if (!route) throw new Error('Route not found');

    const rawStops = await this.db
      .select({
        id: schema.routeStops.id,
        sequenceOrder: schema.routeStops.sequenceOrder,
        type: schema.routeStops.type,
        shipmentId: schema.routeStops.shipmentId,
        address: schema.routeStops.address,
        lat: sql<number>`ST_Y(${schema.routeStops.location})`,
        lng: sql<number>`ST_X(${schema.routeStops.location})`,
      })
      .from(schema.routeStops)
      .where(eq(schema.routeStops.routeId, routeId))
      .orderBy(asc(schema.routeStops.sequenceOrder));

    if (rawStops.length < 2) {
      return { routeId, totalDistanceKm: 0, estimatedDurationMin: 0, stopsReordered: 0, score: 1 };
    }

    const stops: StopCoord[] = rawStops.map((s) => ({
      id: s.id,
      sequenceOrder: s.sequenceOrder,
      type: s.type,
      shipmentId: s.shipmentId,
      lat: Number(s.lat),
      lng: Number(s.lng),
      address: s.address,
    }));

    const vehicleCapacityKg = await this.getVehicleCapacity(route.vehicleId);

    const shipmentWeights = new Map<string, number>();
    if (vehicleCapacityKg > 0) {
      const shipmentIds = [...new Set(stops.filter((s) => s.shipmentId).map((s) => s.shipmentId!))];
      if (shipmentIds.length > 0) {
        const shipmentRows = await this.db
          .select({ id: schema.shipments.id, weightKg: schema.shipments.weightKg })
          .from(schema.shipments)
          .where(sql`${schema.shipments.id} = ANY(${shipmentIds})`);
        for (const row of shipmentRows) {
          shipmentWeights.set(row.id, Number(row.weightKg ?? 0));
        }
      }
    }

    const ordered = this.nearestNeighborWithPrecedence(stops, vehicleCapacityKg, shipmentWeights);

    let totalDistance = 0;
    const lineCoords: string[] = [];
    for (let i = 0; i < ordered.length; i++) {
      lineCoords.push(`${ordered[i].lng} ${ordered[i].lat}`);
      if (i > 0) {
        totalDistance += haversineDistance(
          ordered[i - 1].lat,
          ordered[i - 1].lng,
          ordered[i].lat,
          ordered[i].lng,
        );
      }
    }

    const estimatedDurationMin = Math.round((totalDistance / AVG_SPEED_KMH) * 60);

    const originalDistance = this.computeTotalDistance(stops);
    const score = originalDistance > 0 ? Math.round((1 - totalDistance / originalDistance) * 1000) / 1000 : 0;

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < ordered.length; i++) {
        await tx
          .update(schema.routeStops)
          .set({ sequenceOrder: i, updatedAt: new Date() })
          .where(eq(schema.routeStops.id, ordered[i].id));
      }

      const lineString = `SRID=4326;LINESTRING(${lineCoords.join(',')})`;
      await tx
        .update(schema.routes)
        .set({
          polyline: lineString,
          distanceKm: String(Math.round(totalDistance * 100) / 100),
          estimatedDurationMin,
          status: 'optimized',
          updatedAt: new Date(),
        })
        .where(eq(schema.routes.id, routeId));
    });

    return {
      routeId,
      totalDistanceKm: Math.round(totalDistance * 100) / 100,
      estimatedDurationMin,
      stopsReordered: ordered.length,
      score,
    };
  }

  /**
   * Nearest-neighbor heuristic that respects pickup-before-delivery precedence
   * and cumulative weight capacity constraints.
   */
  private nearestNeighborWithPrecedence(
    stops: StopCoord[],
    capacityKg: number,
    shipmentWeights: Map<string, number>,
  ): StopCoord[] {
    // Build precedence: for each shipment, the pickup stop must come before its delivery
    const pickupForShipment = new Map<string, string>(); // shipmentId → pickup stop id
    for (const s of stops) {
      if (s.type === 'pickup' && s.shipmentId) {
        pickupForShipment.set(s.shipmentId, s.id);
      }
    }

    const ordered: StopCoord[] = [];
    const visited = new Set<string>();
    const pickedUp = new Set<string>(); // shipment IDs that have been picked up
    let currentWeight = 0;

    // Start from the first pickup stop, or just the first stop
    const firstPickup = stops.find((s) => s.type === 'pickup');
    let current = firstPickup ?? stops[0];
    ordered.push(current);
    visited.add(current.id);
    if (current.type === 'pickup' && current.shipmentId) {
      pickedUp.add(current.shipmentId);
      currentWeight += shipmentWeights.get(current.shipmentId) ?? 0;
    }
    if (current.type === 'delivery' && current.shipmentId) {
      currentWeight -= shipmentWeights.get(current.shipmentId) ?? 0;
    }

    while (visited.size < stops.length) {
      let bestDist = Infinity;
      let bestStop: StopCoord | null = null;

      for (const candidate of stops) {
        if (visited.has(candidate.id)) continue;

        // Precedence constraint: can't deliver unless we've picked up
        if (candidate.type === 'delivery' && candidate.shipmentId) {
          const requiredPickupId = pickupForShipment.get(candidate.shipmentId);
          if (requiredPickupId && !visited.has(requiredPickupId)) continue;
        }

        // Capacity constraint on pickups
        if (candidate.type === 'pickup' && candidate.shipmentId && capacityKg > 0) {
          const addWeight = shipmentWeights.get(candidate.shipmentId) ?? 0;
          if (currentWeight + addWeight > capacityKg) continue;
        }

        const dist = haversineDistance(current.lat, current.lng, candidate.lat, candidate.lng);
        if (dist < bestDist) {
          bestDist = dist;
          bestStop = candidate;
        }
      }

      if (!bestStop) {
        // Deadlock: add remaining stops in original order (fallback)
        for (const s of stops) {
          if (!visited.has(s.id)) {
            ordered.push(s);
            visited.add(s.id);
          }
        }
        break;
      }

      ordered.push(bestStop);
      visited.add(bestStop.id);

      if (bestStop.type === 'pickup' && bestStop.shipmentId) {
        pickedUp.add(bestStop.shipmentId);
        currentWeight += shipmentWeights.get(bestStop.shipmentId) ?? 0;
      }
      if (bestStop.type === 'delivery' && bestStop.shipmentId) {
        currentWeight -= shipmentWeights.get(bestStop.shipmentId) ?? 0;
      }

      current = bestStop;
    }

    return ordered;
  }

  private computeTotalDistance(stops: StopCoord[]): number {
    let total = 0;
    for (let i = 1; i < stops.length; i++) {
      total += haversineDistance(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng);
    }
    return total;
  }

  private async getVehicleCapacity(vehicleId: string | null): Promise<number> {
    if (!vehicleId) return 0;
    const [vehicle] = await this.db
      .select({ capacityKg: schema.vehicles.capacityKg })
      .from(schema.vehicles)
      .where(eq(schema.vehicles.id, vehicleId));
    return vehicle ? Number(vehicle.capacityKg ?? 0) : 0;
  }
}
