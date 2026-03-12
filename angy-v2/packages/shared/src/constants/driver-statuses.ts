export const DRIVER_STATUSES = ['available', 'off_duty', 'driving'] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];
