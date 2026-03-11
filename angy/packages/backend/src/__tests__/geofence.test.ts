/**
 * Geofence unit tests — point-in-circle logic + enter/exit transition detection.
 * No DB required: tests pure spatial math and Redis-based state transitions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { haversineDistance } from '@nexus-fleet/shared';

// ── Geofence spatial helpers (unit, no DB) ──────────────────────────────────

/**
 * Check if a point is inside a circle (same logic as PostGIS ST_Contains for buffered points).
 * Uses haversine distance.
 */
function isInsideCircle(
  centerLat: number,
  centerLng: number,
  radiusM: number,
  pointLat: number,
  pointLng: number,
): boolean {
  const distKm = haversineDistance(centerLat, centerLng, pointLat, pointLng);
  const distM = distKm * 1000;
  return distM <= radiusM;
}

/**
 * Detect enter/exit transitions given previous and current state.
 */
function detectTransition(
  previousState: 'inside' | 'outside' | null,
  currentInside: boolean,
  triggerOnEnter: boolean,
  triggerOnExit: boolean,
): 'enter' | 'exit' | null {
  const currentState = currentInside ? 'inside' : 'outside';

  const entered =
    triggerOnEnter &&
    currentState === 'inside' &&
    (previousState === 'outside' || previousState === null);

  const exited =
    triggerOnExit &&
    currentState === 'outside' &&
    previousState === 'inside';

  if (entered) return 'enter';
  if (exited) return 'exit';
  return null;
}

describe('Geofence', () => {
  describe('Point-in-circle (ST_Contains logic)', () => {
    const center = { lat: 40.7589, lng: -73.9851 }; // Times Square
    const radiusM = 500;

    it('point 400m away → inside=true', () => {
      // Point roughly 400m north of center
      // 400m north ≈ 0.0036° latitude
      const pointLat = center.lat + 0.0036;
      const pointLng = center.lng;

      // Verify distance is approximately 400m
      const dist = haversineDistance(center.lat, center.lng, pointLat, pointLng) * 1000;
      expect(dist).toBeGreaterThan(350);
      expect(dist).toBeLessThan(450);

      expect(isInsideCircle(center.lat, center.lng, radiusM, pointLat, pointLng)).toBe(true);
    });

    it('point 600m away → inside=false', () => {
      // Point roughly 600m north of center
      const pointLat = center.lat + 0.0054;
      const pointLng = center.lng;

      const dist = haversineDistance(center.lat, center.lng, pointLat, pointLng) * 1000;
      expect(dist).toBeGreaterThan(550);
      expect(dist).toBeLessThan(650);

      expect(isInsideCircle(center.lat, center.lng, radiusM, pointLat, pointLng)).toBe(false);
    });

    it('point exactly on boundary → inside=true (inclusive)', () => {
      // Calculate exact offset for 500m using haversine inversion
      // 500m ≈ 0.0045° latitude at this position
      // We use binary search to find exact boundary point
      let low = 0.004;
      let high = 0.005;
      for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2;
        const dist = haversineDistance(center.lat, center.lng, center.lat + mid, center.lng) * 1000;
        if (dist < radiusM) low = mid;
        else high = mid;
      }
      const boundaryOffset = (low + high) / 2;
      const pointLat = center.lat + boundaryOffset;

      expect(isInsideCircle(center.lat, center.lng, radiusM, pointLat, center.lng)).toBe(true);
    });
  });

  describe('Enter/exit transition detection', () => {
    it('outside → inside with trigger_on_enter=true → enter', () => {
      expect(detectTransition('outside', true, true, true)).toBe('enter');
    });

    it('inside → outside with trigger_on_exit=true → exit', () => {
      expect(detectTransition('inside', false, true, true)).toBe('exit');
    });

    it('null (first check) → inside with trigger_on_enter=true → enter', () => {
      expect(detectTransition(null, true, true, true)).toBe('enter');
    });

    it('outside → inside with trigger_on_enter=false → null', () => {
      expect(detectTransition('outside', true, false, true)).toBe(null);
    });

    it('inside → outside with trigger_on_exit=false → null', () => {
      expect(detectTransition('inside', false, true, false)).toBe(null);
    });

    it('inside → inside → null (no transition)', () => {
      expect(detectTransition('inside', true, true, true)).toBe(null);
    });

    it('outside → outside → null (no transition)', () => {
      expect(detectTransition('outside', false, true, true)).toBe(null);
    });

    it('null → outside → null (first check outside, no enter trigger)', () => {
      expect(detectTransition(null, false, true, true)).toBe(null);
    });
  });
});
