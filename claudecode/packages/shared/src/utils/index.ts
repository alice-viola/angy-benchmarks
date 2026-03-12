import { SHIPMENT_TRANSITIONS, VEHICLE_LICENSE_REQUIREMENTS } from '../constants/index.js';
import type { ShipmentStatus, VehicleType } from '../constants/index.js';

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @returns Distance in kilometres.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format a shipment reference code.
 *
 * @example formatReferenceCode(new Date('2024-03-15'), 42) // "SHP-20240315-00042"
 */
export function formatReferenceCode(date: Date, sequence: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(5, '0');
  return `SHP-${y}${m}${d}-${seq}`;
}

/**
 * Check whether a shipment status transition is valid.
 */
export function isValidTransition(
  fromStatus: ShipmentStatus,
  toStatus: ShipmentStatus,
): boolean {
  return SHIPMENT_TRANSITIONS[`${fromStatus}:${toStatus}`] === true;
}

/**
 * Get the minimum required license class for a given vehicle type.
 */
export function getRequiredLicenseClass(vehicleType: VehicleType): string {
  return VEHICLE_LICENSE_REQUIREMENTS[vehicleType];
}
