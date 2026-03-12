import { describe, it, expect } from 'vitest';
import { haversine } from '@nexusfleet/shared';

describe('haversine', () => {
  it('NYC to London ~ 5,570 km (±1%)', () => {
    // NYC: 40.7128, -74.0060  London: 51.5074, -0.1278
    const dist = haversine(40.7128, -74.006, 51.5074, -0.1278);
    expect(dist).toBeGreaterThan(5570 * 0.99);
    expect(dist).toBeLessThan(5570 * 1.01);
  });

  it('same point returns 0 km', () => {
    expect(haversine(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('adjacent points return small distance', () => {
    // ~111 m apart (0.001 degree latitude at equator)
    const dist = haversine(0, 0, 0.001, 0);
    expect(dist).toBeGreaterThan(0.1);
    expect(dist).toBeLessThan(0.2);
  });

  it('antipodal points ~ 20,015 km (±1%)', () => {
    // North pole to south pole
    const dist = haversine(90, 0, -90, 0);
    const expected = Math.PI * 6371; // half circumference
    expect(dist).toBeGreaterThan(expected * 0.99);
    expect(dist).toBeLessThan(expected * 1.01);
  });

  it('Sydney to Tokyo ~ 7,823 km (±1%)', () => {
    const dist = haversine(-33.8688, 151.2093, 35.6762, 139.6503);
    expect(dist).toBeGreaterThan(7823 * 0.99);
    expect(dist).toBeLessThan(7823 * 1.01);
  });

  it('is symmetric (A→B == B→A)', () => {
    const ab = haversine(40.7128, -74.006, 51.5074, -0.1278);
    const ba = haversine(51.5074, -0.1278, 40.7128, -74.006);
    expect(ab).toBe(ba);
  });
});
