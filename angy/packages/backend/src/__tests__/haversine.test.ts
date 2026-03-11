import { describe, it, expect } from 'vitest';
import { haversineDistance } from '@nexus-fleet/shared';

describe('haversineDistance', () => {
  it('NYC to LA: ~3940km ±1%', () => {
    const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3940 * 0.99);
    expect(dist).toBeLessThan(3940 * 1.01);
  });

  it('London to Paris: ~344km ±1%', () => {
    const dist = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(344 * 0.99);
    expect(dist).toBeLessThan(344 * 1.01);
  });

  it('Same point: expect 0', () => {
    const dist = haversineDistance(51.5074, -0.1278, 51.5074, -0.1278);
    expect(dist).toBe(0);
  });

  it('Antipodal points: ~20015km ±1%', () => {
    // North pole to south pole
    const dist = haversineDistance(90, 0, -90, 0);
    expect(dist).toBeGreaterThan(20015 * 0.99);
    expect(dist).toBeLessThan(20015 * 1.01);
  });
});
