import { describe, it, expect } from 'vitest';
import { haversineDistance } from '@nexus-fleet/shared';

describe('haversineDistance (shared package on frontend)', () => {
  it('NYC to LA is approximately 3940 km', () => {
    const distance = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeGreaterThan(3900);
    expect(distance).toBeLessThan(3980);
  });

  it('NYC to London is approximately 5570 km', () => {
    const distance = haversineDistance(40.7128, -74.006, 51.5074, -0.1278);
    expect(distance).toBeGreaterThan(5540);
    expect(distance).toBeLessThan(5600);
  });

  it('same point returns 0 km', () => {
    const distance = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
    expect(distance).toBe(0);
  });

  it('NYC Times Square to Empire State Building is approximately 1.3 km', () => {
    const distance = haversineDistance(40.758, -73.9855, 40.7484, -73.9857);
    expect(distance).toBeGreaterThan(1.0);
    expect(distance).toBeLessThan(1.5);
  });

  it('antipodal points (north pole to south pole) is approximately 20015 km', () => {
    const distance = haversineDistance(90, 0, -90, 0);
    expect(distance).toBeGreaterThan(20_000);
    expect(distance).toBeLessThan(20_030);
  });

  it('is commutative', () => {
    const a = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    const b = haversineDistance(34.0522, -118.2437, 40.7128, -74.006);
    expect(a).toBeCloseTo(b, 6);
  });

  it('handles crossing the international date line', () => {
    const distance = haversineDistance(35.6762, 139.6503, 37.7749, -122.4194);
    expect(distance).toBeGreaterThan(8200);
    expect(distance).toBeLessThan(8300);
  });

  it('equator points 180 degrees apart is approximately half Earth circumference', () => {
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(20_000);
    expect(distance).toBeLessThan(20_040);
  });
});
