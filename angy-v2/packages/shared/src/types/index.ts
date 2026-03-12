import { z } from 'zod';

import {
  registerRequestSchema,
  loginRequestSchema,
  registerResponseSchema,
  loginResponseSchema,
  refreshResponseSchema,
  meResponseSchema,
} from '../schemas/auth.js';

import {
  shipmentRequestSchema,
  shipmentUpdateRequestSchema,
  shipmentTransitionRequestSchema,
  shipmentResponseSchema,
  shipmentEventResponseSchema,
} from '../schemas/shipment.js';

import {
  vehicleRequestSchema,
  vehicleUpdateRequestSchema,
  vehicleResponseSchema,
} from '../schemas/vehicle.js';

import {
  driverRequestSchema,
  driverUpdateRequestSchema,
  assignVehicleRequestSchema,
  driverResponseSchema,
} from '../schemas/driver.js';

import {
  routeRequestSchema,
  routeUpdateRequestSchema,
  bulkStopReorderRequestSchema,
  stopCompleteRequestSchema,
  routeResponseSchema,
  routeStopRequestSchema,
} from '../schemas/route.js';

import {
  geofenceRequestSchema,
  geofenceUpdateRequestSchema,
  geofenceResponseSchema,
  geofenceEventResponseSchema,
} from '../schemas/geofence.js';

import {
  webhookRequestSchema,
  webhookUpdateRequestSchema,
  webhookResponseSchema,
  webhookTestResponseSchema,
} from '../schemas/webhook.js';

import {
  userCreateRequestSchema,
  userUpdateRequestSchema,
  userResponseSchema,
} from '../schemas/user.js';

import {
  notificationResponseSchema,
  notificationListMetaSchema,
  markAllReadResponseSchema,
} from '../schemas/notification.js';

import {
  paginationQuerySchema,
  paginationMetaSchema,
  errorResponseSchema,
} from '../schemas/common.js';

// Auth types
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

// Shipment types
export type ShipmentRequest = z.infer<typeof shipmentRequestSchema>;
export type ShipmentUpdateRequest = z.infer<typeof shipmentUpdateRequestSchema>;
export type ShipmentTransitionRequest = z.infer<typeof shipmentTransitionRequestSchema>;
export type ShipmentResponse = z.infer<typeof shipmentResponseSchema>;
export type ShipmentEventResponse = z.infer<typeof shipmentEventResponseSchema>;

// Vehicle types
export type VehicleRequest = z.infer<typeof vehicleRequestSchema>;
export type VehicleUpdateRequest = z.infer<typeof vehicleUpdateRequestSchema>;
export type VehicleResponse = z.infer<typeof vehicleResponseSchema>;

// Driver types
export type DriverRequest = z.infer<typeof driverRequestSchema>;
export type DriverUpdateRequest = z.infer<typeof driverUpdateRequestSchema>;
export type AssignVehicleRequest = z.infer<typeof assignVehicleRequestSchema>;
export type DriverResponse = z.infer<typeof driverResponseSchema>;

// Route types
export type RouteRequest = z.infer<typeof routeRequestSchema>;
export type RouteUpdateRequest = z.infer<typeof routeUpdateRequestSchema>;
export type RouteStopRequest = z.infer<typeof routeStopRequestSchema>;
export type BulkStopReorderRequest = z.infer<typeof bulkStopReorderRequestSchema>;
export type StopCompleteRequest = z.infer<typeof stopCompleteRequestSchema>;
export type RouteResponse = z.infer<typeof routeResponseSchema>;

// Geofence types
export type GeofenceRequest = z.infer<typeof geofenceRequestSchema>;
export type GeofenceUpdateRequest = z.infer<typeof geofenceUpdateRequestSchema>;
export type GeofenceResponse = z.infer<typeof geofenceResponseSchema>;
export type GeofenceEventResponse = z.infer<typeof geofenceEventResponseSchema>;

// Webhook types
export type WebhookRequest = z.infer<typeof webhookRequestSchema>;
export type WebhookUpdateRequest = z.infer<typeof webhookUpdateRequestSchema>;
export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
export type WebhookTestResponse = z.infer<typeof webhookTestResponseSchema>;

// User types
export type UserCreateRequest = z.infer<typeof userCreateRequestSchema>;
export type UserUpdateRequest = z.infer<typeof userUpdateRequestSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;

// Notification types
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
export type NotificationListMeta = z.infer<typeof notificationListMetaSchema>;
export type MarkAllReadResponse = z.infer<typeof markAllReadResponseSchema>;

// Common types
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
