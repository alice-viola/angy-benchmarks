import { z } from 'zod';
import {
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  DRIVER_STATUSES,
  SHIPMENT_STATUSES,
  SHIPMENT_PRIORITIES,
  CARGO_TYPES,
  ROUTE_STATUSES,
  STOP_TYPES,
  STOP_STATUSES,
  USER_ROLES,
  TENANT_PLANS,
  GEOFENCE_EVENT_TYPES,
  SHIPMENT_TRANSITION_ACTIONS,
  WS_CHANNELS,
  WEBHOOK_EVENTS,
} from '../constants/index.js';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const coordinateSchema = z.object({
  lat: latitude,
  lng: longitude,
});

const addressSchema = z.object({
  street: z.string().min(1).max(500),
  city: z.string().min(1).max(200),
  state: z.string().min(1).max(200),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(3),
  lat: latitude.optional(),
  lng: longitude.optional(),
});

const timestampFields = {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

const uuidField = z.string().uuid();

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=]).{8,}$/,
      'Password must contain uppercase, lowercase, digit, and special character',
    ),
  name: z.string().min(1).max(200),
  tenantName: z.string().min(1).max(200),
});

export const authTokenPayloadSchema = z.object({
  sub: uuidField,
  email: z.string().email(),
  tenantId: uuidField,
  role: z.enum(USER_ROLES),
  iat: z.number(),
  exp: z.number(),
});

// ---------------------------------------------------------------------------
// Tenant schemas
// ---------------------------------------------------------------------------

export const tenantSchema = z.object({
  id: uuidField,
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  plan: z.enum(TENANT_PLANS),
  ...timestampFields,
});

export const createTenantSchema = tenantSchema.pick({
  name: true,
  slug: true,
  plan: true,
});

export const updateTenantSchema = createTenantSchema.partial();

// ---------------------------------------------------------------------------
// User schemas
// ---------------------------------------------------------------------------

export const userSchema = z.object({
  id: uuidField,
  tenantId: uuidField,
  email: z.string().email().max(320),
  name: z.string().min(1).max(200),
  role: z.enum(USER_ROLES),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  ...timestampFields,
});

export const createUserSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(USER_ROLES).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Vehicle schemas
// ---------------------------------------------------------------------------

export const vehicleSchema = z.object({
  id: uuidField,
  tenantId: uuidField,
  vin: z.string().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'Invalid VIN format'),
  licensePlate: z.string().min(1).max(20),
  type: z.enum(VEHICLE_TYPES),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(2100),
  status: z.enum(VEHICLE_STATUSES),
  capacityKg: z.number().positive().max(100_000),
  capacityM3: z.number().positive().max(500).optional(),
  fuelType: z.string().min(1).max(50).optional(),
  currentLat: latitude.nullable().optional(),
  currentLng: longitude.nullable().optional(),
  currentSpeed: z.number().min(0).max(300).nullable().optional(),
  currentHeading: z.number().min(0).max(360).nullable().optional(),
  lastLocationUpdate: z.string().datetime().nullable().optional(),
  odometerKm: z.number().min(0).nullable().optional(),
  ...timestampFields,
});

export const createVehicleSchema = z.object({
  vin: z.string().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'Invalid VIN format'),
  licensePlate: z.string().min(1).max(20),
  type: z.enum(VEHICLE_TYPES),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(2100),
  capacityKg: z.number().positive().max(100_000),
  capacityM3: z.number().positive().max(500).optional(),
  fuelType: z.string().min(1).max(50).optional(),
});

export const updateVehicleSchema = z.object({
  licensePlate: z.string().min(1).max(20).optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  capacityKg: z.number().positive().max(100_000).optional(),
  capacityM3: z.number().positive().max(500).optional(),
  fuelType: z.string().min(1).max(50).optional(),
  odometerKm: z.number().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Driver schemas
// ---------------------------------------------------------------------------

export const driverSchema = z.object({
  id: uuidField,
  tenantId: uuidField,
  userId: uuidField.nullable().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(320),
  phone: z.string().min(7).max(20),
  licenseNumber: z.string().min(1).max(50),
  licenseClass: z.string().min(1).max(10),
  licenseExpiry: z.string().date(),
  status: z.enum(DRIVER_STATUSES),
  currentVehicleId: uuidField.nullable().optional(),
  currentLat: latitude.nullable().optional(),
  currentLng: longitude.nullable().optional(),
  ...timestampFields,
});

export const createDriverSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(320),
  phone: z.string().min(7).max(20),
  licenseNumber: z.string().min(1).max(50),
  licenseClass: z.string().min(1).max(10),
  licenseExpiry: z.string().date(),
});

export const updateDriverSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(7).max(20).optional(),
  licenseNumber: z.string().min(1).max(50).optional(),
  licenseClass: z.string().min(1).max(10).optional(),
  licenseExpiry: z.string().date().optional(),
  status: z.enum(DRIVER_STATUSES).optional(),
  currentVehicleId: uuidField.nullable().optional(),
});

// ---------------------------------------------------------------------------
// Shipment schemas
// ---------------------------------------------------------------------------

export const shipmentSchema = z.object({
  id: uuidField,
  tenantId: uuidField,
  referenceNumber: z.string().min(1).max(50),
  status: z.enum(SHIPMENT_STATUSES),
  priority: z.enum(SHIPMENT_PRIORITIES),
  cargoType: z.enum(CARGO_TYPES),
  cargoDescription: z.string().max(1000).optional(),
  weightKg: z.number().positive().max(100_000),
  volumeM3: z.number().positive().max(500).optional(),
  pickupAddress: addressSchema,
  deliveryAddress: addressSchema,
  scheduledPickup: z.string().datetime(),
  scheduledDelivery: z.string().datetime(),
  actualPickup: z.string().datetime().nullable().optional(),
  actualDelivery: z.string().datetime().nullable().optional(),
  assignedVehicleId: uuidField.nullable().optional(),
  assignedDriverId: uuidField.nullable().optional(),
  assignedRouteId: uuidField.nullable().optional(),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(320).optional(),
  customerPhone: z.string().min(7).max(20).optional(),
  notes: z.string().max(2000).optional(),
  ...timestampFields,
});

export const createShipmentSchema = z
  .object({
    referenceNumber: z.string().min(1).max(50),
    priority: z.enum(SHIPMENT_PRIORITIES).default('normal'),
    cargoType: z.enum(CARGO_TYPES).default('general'),
    cargoDescription: z.string().max(1000).optional(),
    weightKg: z.number().positive().max(100_000),
    volumeM3: z.number().positive().max(500).optional(),
    pickupAddress: addressSchema,
    deliveryAddress: addressSchema,
    scheduledPickup: z.string().datetime(),
    scheduledDelivery: z.string().datetime(),
    customerName: z.string().min(1).max(200),
    customerEmail: z.string().email().max(320).optional(),
    customerPhone: z.string().min(7).max(20).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((data) => new Date(data.scheduledDelivery) > new Date(data.scheduledPickup), {
    message: 'Scheduled delivery must be after scheduled pickup',
    path: ['scheduledDelivery'],
  });

export const updateShipmentSchema = z.object({
  priority: z.enum(SHIPMENT_PRIORITIES).optional(),
  cargoType: z.enum(CARGO_TYPES).optional(),
  cargoDescription: z.string().max(1000).optional(),
  weightKg: z.number().positive().max(100_000).optional(),
  volumeM3: z.number().positive().max(500).optional(),
  pickupAddress: addressSchema.optional(),
  deliveryAddress: addressSchema.optional(),
  scheduledPickup: z.string().datetime().optional(),
  scheduledDelivery: z.string().datetime().optional(),
  customerName: z.string().min(1).max(200).optional(),
  customerEmail: z.string().email().max(320).optional(),
  customerPhone: z.string().min(7).max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const shipmentTransitionSchema = z.object({
  action: z.enum(SHIPMENT_TRANSITION_ACTIONS),
  vehicleId: uuidField.optional(),
  driverId: uuidField.optional(),
  notes: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Route schemas
// ---------------------------------------------------------------------------

export const routeStopSchema = z.object({
  id: uuidField,
  routeId: uuidField,
  shipmentId: uuidField.nullable().optional(),
  type: z.enum(STOP_TYPES),
  status: z.enum(STOP_STATUSES),
  sequence: z.number().int().min(0),
  address: addressSchema,
  scheduledArrival: z.string().datetime().optional(),
  scheduledDeparture: z.string().datetime().optional(),
  actualArrival: z.string().datetime().nullable().optional(),
  actualDeparture: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).optional(),
  ...timestampFields,
});

export const createRouteStopSchema = z.object({
  shipmentId: uuidField.optional(),
  type: z.enum(STOP_TYPES),
  sequence: z.number().int().min(0),
  address: addressSchema,
  scheduledArrival: z.string().datetime().optional(),
  scheduledDeparture: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

export const routeSchema = z.object({
  id: uuidField,
  tenantId: uuidField,
  name: z.string().min(1).max(200),
  status: z.enum(ROUTE_STATUSES),
  vehicleId: uuidField.nullable().optional(),
  driverId: uuidField.nullable().optional(),
  scheduledDate: z.string().date(),
  startAddress: addressSchema.optional(),
  endAddress: addressSchema.optional(),
  totalDistanceKm: z.number().min(0).nullable().optional(),
  totalDurationMin: z.number().min(0).nullable().optional(),
  stops: z.array(routeStopSchema).optional(),
  ...timestampFields,
});

export const createRouteSchema = z.object({
  name: z.string().min(1).max(200),
  vehicleId: uuidField.optional(),
  driverId: uuidField.optional(),
  scheduledDate: z.string().date(),
  startAddress: addressSchema.optional(),
  endAddress: addressSchema.optional(),
  stops: z.array(createRouteStopSchema).optional(),
});

export const updateRouteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(ROUTE_STATUSES).optional(),
  vehicleId: uuidField.nullable().optional(),
  driverId: uuidField.nullable().optional(),
  scheduledDate: z.string().date().optional(),
  startAddress: addressSchema.optional(),
  endAddress: addressSchema.optional(),
});

// ---------------------------------------------------------------------------
// Geofence schemas
// ---------------------------------------------------------------------------

export const geofenceSchema = z.object({
  id: uuidField,
  tenantId: uuidField,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  lat: latitude,
  lng: longitude,
  radiusM: z.number().positive().max(100_000),
  isActive: z.boolean(),
  ...timestampFields,
});

export const createGeofenceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  lat: latitude,
  lng: longitude,
  radiusM: z.number().positive().max(100_000),
  isActive: z.boolean().default(true),
});

export const updateGeofenceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
  radiusM: z.number().positive().max(100_000).optional(),
  isActive: z.boolean().optional(),
});

export const geofenceEventSchema = z.object({
  id: uuidField,
  tenantId: uuidField,
  geofenceId: uuidField,
  vehicleId: uuidField,
  eventType: z.enum(GEOFENCE_EVENT_TYPES),
  lat: latitude,
  lng: longitude,
  triggeredAt: z.string().datetime(),
  ...timestampFields,
});

// ---------------------------------------------------------------------------
// Webhook schemas
// ---------------------------------------------------------------------------

export const webhookSchema = z.object({
  id: uuidField,
  tenantId: uuidField,
  url: z.string().url().max(2048),
  secret: z.string().min(16).max(256),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  isActive: z.boolean(),
  ...timestampFields,
});

export const createWebhookSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  isActive: z.boolean().default(true),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// WebSocket schemas
// ---------------------------------------------------------------------------

export const locationUpdateSchema = z.object({
  vehicleId: uuidField,
  lat: latitude,
  lng: longitude,
  speed: z.number().min(0).max(300).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.string().datetime(),
});

export const wsSubscribeSchema = z.object({
  action: z.literal('subscribe'),
  channel: z.enum(WS_CHANNELS),
  entityIds: z.array(uuidField).min(1).max(100).optional(),
});

export const wsUnsubscribeSchema = z.object({
  action: z.literal('unsubscribe'),
  channel: z.enum(WS_CHANNELS),
  entityIds: z.array(uuidField).optional(),
});

export const wsMessageSchema = z.discriminatedUnion('action', [
  wsSubscribeSchema,
  wsUnsubscribeSchema,
]);

// ---------------------------------------------------------------------------
// Pagination & filtering
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const vehicleFilterSchema = paginationSchema.extend({
  status: z.enum(VEHICLE_STATUSES).optional(),
  type: z.enum(VEHICLE_TYPES).optional(),
  search: z.string().max(200).optional(),
});

export const driverFilterSchema = paginationSchema.extend({
  status: z.enum(DRIVER_STATUSES).optional(),
  search: z.string().max(200).optional(),
});

export const shipmentFilterSchema = paginationSchema.extend({
  status: z.enum(SHIPMENT_STATUSES).optional(),
  priority: z.enum(SHIPMENT_PRIORITIES).optional(),
  cargoType: z.enum(CARGO_TYPES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
});

export const routeFilterSchema = paginationSchema.extend({
  status: z.enum(ROUTE_STATUSES).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  vehicleId: uuidField.optional(),
  driverId: uuidField.optional(),
});

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export function apiErrorResponseSchema() {
  return z.object({
    success: z.literal(false),
    error: apiErrorSchema,
  });
}

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  });
}

// Re-export building blocks so consumers can compose
export { coordinateSchema, addressSchema };
