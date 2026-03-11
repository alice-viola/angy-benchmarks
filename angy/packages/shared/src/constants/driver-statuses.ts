export const DRIVER_STATUSES = [
  'off_duty',
  'available',
  'driving',
  'on_break',
] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];
