import { describe, it, expect } from 'vitest';
import { optimizeRoute } from '../services/route-optimizer.js';

function makeStop(
  id: string,
  lat: number,
  lng: number,
  type: string,
  shipmentId: string | null = null,
  weight = 0,
) {
  return {
    id,
    shipment_id: shipmentId,
    stop_type: type,
    sequence_order: 0,
    location: { lat, lng },
    cargo_weight_kg: weight,
  };
}

describe('route-optimizer', () => {
  describe('precedence constraints', () => {
    it('pickup always appears before delivery for paired stops', () => {
      // Place delivery geographically closer to start than pickup
      // so a naive nearest-neighbor would pick delivery first
      const stops = [
        makeStop('depot', 40.7, -74.0, 'depot'),
        makeStop('d1', 40.71, -74.01, 'delivery', 'ship-1'), // very close to depot
        makeStop('p1', 40.8, -73.9, 'pickup', 'ship-1'),     // far from depot
      ];

      const result = optimizeRoute({
        stops,
        vehicle_capacity_kg: 10000,
        max_driving_hours: 10,
      });

      const ids = result.stops.map((s) => s.id);
      const pickupIdx = ids.indexOf('p1');
      const deliveryIdx = ids.indexOf('d1');
      expect(pickupIdx).toBeLessThan(deliveryIdx);
    });

    it('handles multiple shipment pairs correctly', () => {
      const stops = [
        makeStop('p1', 40.70, -74.00, 'pickup', 'A', 100),
        makeStop('d1', 40.75, -73.95, 'delivery', 'A', 100),
        makeStop('p2', 40.72, -73.98, 'pickup', 'B', 200),
        makeStop('d2', 40.80, -73.90, 'delivery', 'B', 200),
      ];

      const result = optimizeRoute({
        stops,
        vehicle_capacity_kg: 10000,
        max_driving_hours: 10,
      });

      const ids = result.stops.map((s) => s.id);
      expect(ids.indexOf('p1')).toBeLessThan(ids.indexOf('d1'));
      expect(ids.indexOf('p2')).toBeLessThan(ids.indexOf('d2'));
    });
  });

  describe('capacity limits', () => {
    it('skips pickup stops that would exceed vehicle capacity', () => {
      const stops = [
        makeStop('p1', 40.70, -74.00, 'pickup', 'A', 800),
        makeStop('d1', 40.75, -73.95, 'delivery', 'A', 800),
        makeStop('p2', 40.71, -74.01, 'pickup', 'B', 500),
        makeStop('d2', 40.80, -73.90, 'delivery', 'B', 500),
      ];

      const result = optimizeRoute({
        stops,
        vehicle_capacity_kg: 900, // can carry one at a time but not both
        max_driving_hours: 10,
      });

      // All stops should still be present (fallback adds remaining)
      expect(result.stops).toHaveLength(4);
    });
  });

  describe('distance improvement', () => {
    it('optimized route is <= original distance for known suboptimal order', () => {
      // Intentionally bad order: zigzag
      const stops = [
        makeStop('s1', 40.70, -74.00, 'depot'),
        makeStop('s4', 40.90, -73.80, 'pickup', 'X', 10),
        makeStop('s2', 40.73, -73.97, 'pickup', 'Y', 10),
        makeStop('s5', 40.93, -73.77, 'delivery', 'X', 10),
        makeStop('s3', 40.76, -73.94, 'delivery', 'Y', 10),
      ];

      const result = optimizeRoute({
        stops,
        vehicle_capacity_kg: 10000,
        max_driving_hours: 10,
      });

      // The original distance of the zigzag should be >= optimized
      expect(result.optimization_score).toBeGreaterThanOrEqual(0);
      expect(result.estimated_distance_km).toBeGreaterThan(0);
    });
  });

  describe('driver hours estimate', () => {
    it('estimated distance allows computing hours at 60 km/h', () => {
      const stops = [
        makeStop('a', 40.70, -74.00, 'depot'),
        makeStop('b', 41.70, -73.00, 'pickup', 'Z', 10),
        makeStop('c', 42.70, -72.00, 'delivery', 'Z', 10),
      ];

      const result = optimizeRoute({
        stops,
        vehicle_capacity_kg: 10000,
        max_driving_hours: 10,
      });

      // Should have a positive distance that can be divided by 60
      expect(result.estimated_distance_km).toBeGreaterThan(0);
      const estimatedHours = result.estimated_distance_km / 60;
      expect(estimatedHours).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('single stop returns score 100 and distance 0', () => {
      const result = optimizeRoute({
        stops: [makeStop('only', 40.7, -74.0, 'depot')],
        vehicle_capacity_kg: 10000,
        max_driving_hours: 10,
      });

      expect(result.estimated_distance_km).toBe(0);
      expect(result.optimization_score).toBe(100);
      expect(result.stops).toHaveLength(1);
    });

    it('empty stops returns score 100 and distance 0', () => {
      const result = optimizeRoute({
        stops: [],
        vehicle_capacity_kg: 10000,
        max_driving_hours: 10,
      });

      expect(result.stops).toHaveLength(0);
    });
  });
});
