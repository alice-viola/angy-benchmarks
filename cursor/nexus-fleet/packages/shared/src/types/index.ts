import { z } from 'zod';
import {
  loginSchema,
  registerSchema,
  authTokenPayloadSchema,
  tenantSchema,
  createTenantSchema,
  updateTenantSchema,
  userSchema,
  createUserSchema,
  updateUserSchema,
  vehicleSchema,
  createVehicleSchema,
  updateVehicleSchema,
  driverSchema,
  createDriverSchema,
  updateDriverSchema,
  shipmentSchema,
  createShipmentSchema,
  updateShipmentSchema,
  shipmentTransitionSchema,
  routeSchema,
  createRouteSchema,
  updateRouteSchema,
  routeStopSchema,
  createRouteStopSchema,
  geofenceSchema,
  createGeofenceSchema,
  updateGeofenceSchema,
  geofenceEventSchema,
  webhookSchema,
  createWebhookSchema,
  updateWebhookSchema,
  locationUpdateSchema,
  wsSubscribeSchema,
  wsUnsubscribeSchema,
  wsMessageSchema,
  paginationSchema,
  vehicleFilterSchema,
  driverFilterSchema,
  shipmentFilterSchema,
  routeFilterSchema,
  apiErrorSchema,
  coordinateSchema,
  addressSchema,
} from '../schemas/index.js';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type Coordinate = z.infer<typeof coordinateSchema>;
export type Address = z.infer<typeof addressSchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AuthTokenPayload = z.infer<typeof authTokenPayloadSchema>;

// ---------------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------------

export type Tenant = z.infer<typeof tenantSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ---------------------------------------------------------------------------
// Vehicle
// ---------------------------------------------------------------------------

export type Vehicle = z.infer<typeof vehicleSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export type Driver = z.infer<typeof driverSchema>;
export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;

// ---------------------------------------------------------------------------
// Shipment
// ---------------------------------------------------------------------------

export type Shipment = z.infer<typeof shipmentSchema>;
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type ShipmentTransitionInput = z.infer<typeof shipmentTransitionSchema>;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export type Route = z.infer<typeof routeSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type RouteStop = z.infer<typeof routeStopSchema>;
export type CreateRouteStopInput = z.infer<typeof createRouteStopSchema>;

// ---------------------------------------------------------------------------
// Geofence
// ---------------------------------------------------------------------------

export type Geofence = z.infer<typeof geofenceSchema>;
export type CreateGeofenceInput = z.infer<typeof createGeofenceSchema>;
export type UpdateGeofenceInput = z.infer<typeof updateGeofenceSchema>;
export type GeofenceEvent = z.infer<typeof geofenceEventSchema>;

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type Webhook = z.infer<typeof webhookSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

export type LocationUpdate = z.infer<typeof locationUpdateSchema>;
export type WsSubscribeMessage = z.infer<typeof wsSubscribeSchema>;
export type WsUnsubscribeMessage = z.infer<typeof wsUnsubscribeSchema>;
export type WsMessage = z.infer<typeof wsMessageSchema>;

// ---------------------------------------------------------------------------
// Pagination & filtering
// ---------------------------------------------------------------------------

export type PaginationParams = z.infer<typeof paginationSchema>;
export type VehicleFilterParams = z.infer<typeof vehicleFilterSchema>;
export type DriverFilterParams = z.infer<typeof driverFilterSchema>;
export type ShipmentFilterParams = z.infer<typeof shipmentFilterSchema>;
export type RouteFilterParams = z.infer<typeof routeFilterSchema>;

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export type ApiError = z.infer<typeof apiErrorSchema>;

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
