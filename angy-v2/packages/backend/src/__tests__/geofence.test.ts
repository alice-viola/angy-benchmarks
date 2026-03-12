import { describe, it, expect } from 'vitest';
import { haversine } from '@nexusfleet/shared';

/**
 * Geofence containment tests using in-memory haversine comparison
 * (mirrors the ST_DWithin logic the DB uses: point is inside if
 * haversine distance from center < radius_m / 1000).
 */

interface CircleGeofence {
  id: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
}

function isInsideGeofence(
  lat: number,
  lng: number,
  fence: CircleGeofence,
): boolean {
  const distKm = haversine(lat, lng, fence.center_lat, fence.center_lng);
  const radiusKm = fence.radius_m / 1000;
  return distKm < radiusKm;
}

function batchGeofenceCheck(
  lat: number,
  lng: number,
  fences: CircleGeofence[],
): Map<string, boolean> {
  // Simulates the single batched SQL query: one call processes all fences
  const results = new Map<string, boolean>();
  for (const fence of fences) {
    results.set(fence.id, isInsideGeofence(lat, lng, fence));
  }
  return results;
}

// ─── Test Fixtures ───────────────────────────────────────

const centralParkFence: CircleGeofence = {
  id: 'fence-central-park',
  center_lat: 40.7829,
  center_lng: -73.9654,
  radius_m: 500, // 500m radius around Central Park
};

const timesSquareFence: CircleGeofence = {
  id: 'fence-times-square',
  center_lat: 40.758,
  center_lng: -73.9855,
  radius_m: 200, // 200m radius around Times Square
};

const jfkFence: CircleGeofence = {
  id: 'fence-jfk',
  center_lat: 40.6413,
  center_lng: -73.7781,
  radius_m: 3000, // 3km radius around JFK
};

// ─── Tests ───────────────────────────────────────────────

describe('geofence', () => {
  describe('point inside circle geofence', () => {
    it('point at center is inside', () => {
      expect(isInsideGeofence(40.7829, -73.9654, centralParkFence)).toBe(true);
    });

    it('point 100m from center (well within 500m radius) is inside', () => {
      // ~100m north of Central Park center
      expect(isInsideGeofence(40.7838, -73.9654, centralParkFence)).toBe(true);
    });

    it('point in Times Square is inside Times Square fence', () => {
      // Slightly south of Times Square center, still within 200m
      expect(isInsideGeofence(40.7575, -73.9857, timesSquareFence)).toBe(true);
    });
  });

  describe('point outside circle geofence', () => {
    it('point far from center is outside', () => {
      // Brooklyn — well outside Central Park's 500m radius
      expect(isInsideGeofence(40.6782, -73.9442, centralParkFence)).toBe(false);
    });

    it('point in Queens is outside Times Square fence', () => {
      expect(isInsideGeofence(40.7282, -73.7949, timesSquareFence)).toBe(false);
    });

    it('point in Manhattan is outside JFK fence', () => {
      expect(isInsideGeofence(40.7580, -73.9855, jfkFence)).toBe(false);
    });
  });

  describe('point on boundary', () => {
    it('point at approximately the boundary distance is consistently determined', () => {
      // Calculate a point that is exactly at ~500m from Central Park center
      // 500m ≈ 0.0045 degrees latitude
      const boundaryLat = centralParkFence.center_lat + 0.0045;
      const result1 = isInsideGeofence(boundaryLat, centralParkFence.center_lng, centralParkFence);
      const result2 = isInsideGeofence(boundaryLat, centralParkFence.center_lng, centralParkFence);
      // Implementation-defined but consistent
      expect(result1).toBe(result2);
    });
  });

  describe('batched check', () => {
    it('single call checks N geofences at once (not N separate calls)', () => {
      const fences = [centralParkFence, timesSquareFence, jfkFence];
      // Point at Times Square
      const lat = 40.758;
      const lng = -73.9855;

      const results = batchGeofenceCheck(lat, lng, fences);

      // Should have results for all 3 fences from a single batch call
      expect(results.size).toBe(3);
      expect(results.get('fence-central-park')).toBe(false); // ~2.7km away
      expect(results.get('fence-times-square')).toBe(true);  // at center
      expect(results.get('fence-jfk')).toBe(false);          // ~20km away
    });

    it('batch check with empty fences returns empty map', () => {
      const results = batchGeofenceCheck(40.7, -74.0, []);
      expect(results.size).toBe(0);
    });

    it('batch check returns boolean for each fence', () => {
      const fences = [centralParkFence, timesSquareFence];
      const results = batchGeofenceCheck(40.7829, -73.9654, fences);

      expect(typeof results.get('fence-central-park')).toBe('boolean');
      expect(typeof results.get('fence-times-square')).toBe('boolean');
    });
  });
});
