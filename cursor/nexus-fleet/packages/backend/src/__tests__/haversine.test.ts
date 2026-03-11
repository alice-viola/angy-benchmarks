import { describe, it, expect } from 'vitest';
import { haversineDistance } from '@nexus-fleet/shared';

describe('haversineDistance', () => {
  it('NYC to LA is approximately 3940 km', () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const la = { lat: 34.0522, lng: -118.2437 };
    const distance = haversineDistance(nyc.lat, nyc.lng, la.lat, la.lng);
    expect(distance).toBeGreaterThan(3900);
    expect(distance).toBeLessThan(3980);
  });

  it('NYC to London is approximately 5570 km', () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const london = { lat: 51.5074, lng: -0.1278 };
    const distance = haversineDistance(nyc.lat, nyc.lng, london.lat, london.lng);
    expect(distance).toBeGreaterThan(5540);
    expect(distance).toBeLessThan(5600);
  });

  it('same point returns 0 km', () => {
    const distance = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
    expect(distance).toBe(0);
  });

  it('NYC Times Square to Empire State Building is approximately 1.3 km', () => {
    const timesSquare = { lat: 40.758, lng: -73.9855 };
    const empireState = { lat: 40.7484, lng: -73.9857 };
    const distance = haversineDistance(
      timesSquare.lat,
      timesSquare.lng,
      empireState.lat,
      empireState.lng,
    );
    expect(distance).toBeGreaterThan(1.0);
    expect(distance).toBeLessThan(1.5);
  });

  it('antipodal points (north pole to south pole) is approximately 20015 km', () => {
    const northPole = { lat: 90, lng: 0 };
    const southPole = { lat: -90, lng: 0 };
    const distance = haversineDistance(
      northPole.lat,
      northPole.lng,
      southPole.lat,
      southPole.lng,
    );
    expect(distance).toBeGreaterThan(20_000);
    expect(distance).toBeLessThan(20_030);
  });

  it('is commutative (A→B equals B→A)', () => {
    const a = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    const b = haversineDistance(34.0522, -118.2437, 40.7128, -74.006);
    expect(a).toBeCloseTo(b, 6);
  });

  it('handles crossing the international date line', () => {
    const tokyo = { lat: 35.6762, lng: 139.6503 };
    const sf = { lat: 37.7749, lng: -122.4194 };
    const distance = haversineDistance(tokyo.lat, tokyo.lng, sf.lat, sf.lng);
    expect(distance).toBeGreaterThan(8200);
    expect(distance).toBeLessThan(8300);
  });

  it('equator points 180 degrees apart is approximately half Earth circumference', () => {
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(20_000);
    expect(distance).toBeLessThan(20_040);
  });
});
