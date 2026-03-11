export const VEHICLE_STATUSES = [
  'available',
  'in_transit',
  'idle',
  'maintenance',
  'decommissioned',
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
