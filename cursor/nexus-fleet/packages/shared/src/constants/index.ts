export const VEHICLE_STATUSES = ['available', 'in_transit', 'idle', 'maintenance', 'decommissioned'] as const;
export type VehicleStatus = typeof VEHICLE_STATUSES[number];

export const VEHICLE_TYPES = ['van', 'truck', 'semi', 'refrigerated'] as const;
export type VehicleType = typeof VEHICLE_TYPES[number];

export const DRIVER_STATUSES = ['off_duty', 'available', 'driving', 'on_break'] as const;
export type DriverStatus = typeof DRIVER_STATUSES[number];

export const SHIPMENT_STATUSES = ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'failed', 'cancelled'] as const;
export type ShipmentStatus = typeof SHIPMENT_STATUSES[number];

export const SHIPMENT_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export type ShipmentPriority = typeof SHIPMENT_PRIORITIES[number];

export const CARGO_TYPES = ['general', 'fragile', 'hazardous', 'perishable'] as const;
export type CargoType = typeof CARGO_TYPES[number];

export const ROUTE_STATUSES = ['draft', 'optimized', 'active', 'completed'] as const;
export type RouteStatus = typeof ROUTE_STATUSES[number];

export const STOP_TYPES = ['pickup', 'delivery', 'depot'] as const;
export type StopType = typeof STOP_TYPES[number];

export const STOP_STATUSES = ['pending', 'arrived', 'completed', 'skipped'] as const;
export type StopStatus = typeof STOP_STATUSES[number];

export const USER_ROLES = ['owner', 'admin', 'dispatcher', 'viewer'] as const;
export type UserRole = typeof USER_ROLES[number];

export const TENANT_PLANS = ['free', 'pro', 'enterprise'] as const;
export type TenantPlan = typeof TENANT_PLANS[number];

export const GEOFENCE_EVENT_TYPES = ['enter', 'exit'] as const;
export type GeofenceEventType = typeof GEOFENCE_EVENT_TYPES[number];

export const SHIPMENT_TRANSITION_ACTIONS = ['confirm', 'assign', 'pickup', 'deliver', 'fail', 'complete', 'cancel'] as const;
export type ShipmentTransitionAction = typeof SHIPMENT_TRANSITION_ACTIONS[number];

export const VEHICLE_LICENSE_REQUIREMENTS: Record<string, string> = {
  van: 'B',
  truck: 'C',
  semi: 'CE',
  refrigerated: 'C',
};

export const RATE_LIMITS: Record<string, number> = {
  free: 100,
  pro: 500,
  enterprise: 2000,
};

export const WS_CONNECTION_LIMITS: Record<string, number> = {
  free: 5,
  pro: 20,
  enterprise: 100,
};

export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit'],
  in_transit: ['delivered', 'failed'],
  delivered: ['completed'],
  failed: ['confirmed'],
  cancelled: [],
  completed: [],
};

export const WS_CHANNELS = ['tracking', 'shipment_updates', 'alerts'] as const;
export type WsChannel = typeof WS_CHANNELS[number];

export const WEBHOOK_EVENTS = ['shipment.status_changed', 'shipment.completed', 'shipment.failed', 'geofence.triggered'] as const;
export type WebhookEvent = typeof WEBHOOK_EVENTS[number];
