export const VEHICLE_TYPES = ['van', 'truck', 'semi', 'refrigerated'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_LICENSE_REQUIREMENTS: Record<VehicleType, string> = {
  van: 'B',
  truck: 'C',
  semi: 'CE',
  refrigerated: 'C',
};
