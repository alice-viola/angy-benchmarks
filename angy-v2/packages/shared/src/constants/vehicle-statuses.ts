export const VEHICLE_STATUSES = ['available', 'in_transit', 'maintenance', 'decommissioned'] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_TYPE_LICENSE_MAP: Record<string, string> = {
  van: 'B',
  truck: 'C',
  semi: 'CE',
  refrigerated: 'C',
};
