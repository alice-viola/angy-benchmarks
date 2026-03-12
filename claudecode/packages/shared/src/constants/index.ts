export const SHIPMENT_STATUSES = [
  'draft',
  'confirmed',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'completed',
  'failed',
  'cancelled',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const VEHICLE_STATUSES = [
  'available',
  'in_transit',
  'idle',
  'maintenance',
  'decommissioned',
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const DRIVER_STATUSES = [
  'off_duty',
  'available',
  'driving',
  'on_break',
] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const VEHICLE_TYPES = ['van', 'truck', 'semi', 'refrigerated'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const CARGO_TYPES = [
  'general',
  'fragile',
  'hazardous',
  'perishable',
] as const;

export type CargoType = (typeof CARGO_TYPES)[number];

export const PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;

export type Priority = (typeof PRIORITIES)[number];

export const USER_ROLES = ['owner', 'admin', 'dispatcher', 'viewer'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const TENANT_PLANS = ['free', 'pro', 'enterprise'] as const;

export type TenantPlan = (typeof TENANT_PLANS)[number];

export const ROUTE_STATUSES = [
  'draft',
  'optimized',
  'active',
  'completed',
] as const;

export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const STOP_TYPES = ['pickup', 'delivery', 'depot'] as const;

export type StopType = (typeof STOP_TYPES)[number];

export const STOP_STATUSES = [
  'pending',
  'arrived',
  'completed',
  'skipped',
] as const;

export type StopStatus = (typeof STOP_STATUSES)[number];

export const GEOFENCE_EVENT_TYPES = ['enter', 'exit'] as const;

export type GeofenceEventType = (typeof GEOFENCE_EVENT_TYPES)[number];

/**
 * Valid shipment state transitions keyed by "fromState:toState".
 * A truthy value means the transition is allowed.
 */
export const SHIPMENT_TRANSITIONS: Record<string, boolean> = {
  'draft:confirmed': true,
  'draft:cancelled': true,
  'confirmed:assigned': true,
  'confirmed:cancelled': true,
  'assigned:picked_up': true,
  'assigned:cancelled': true,
  'picked_up:in_transit': true,
  'in_transit:delivered': true,
  'in_transit:failed': true,
  'delivered:completed': true,
  'failed:confirmed': true,
};

/**
 * Maps vehicle type to the minimum required license class.
 */
export const VEHICLE_LICENSE_REQUIREMENTS: Record<VehicleType, string> = {
  van: 'B',
  truck: 'C',
  semi: 'CE',
  refrigerated: 'C',
};

/**
 * Rate limits per tenant plan.
 */
export const RATE_LIMITS: Record<
  TenantPlan,
  { requests: number; wsConnections: number }
> = {
  free: { requests: 100, wsConnections: 5 },
  pro: { requests: 500, wsConnections: 20 },
  enterprise: { requests: 2000, wsConnections: 100 },
};
