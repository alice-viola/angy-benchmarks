import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '../schemas/auth.schemas.js';
import {
  createShipmentSchema,
  updateShipmentSchema,
  shipmentActionSchema,
  shipmentFilterSchema,
} from '../schemas/shipment.schemas.js';
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleFilterSchema,
} from '../schemas/vehicle.schemas.js';
import {
  createDriverSchema,
  updateDriverSchema,
  driverFilterSchema,
} from '../schemas/driver.schemas.js';
import {
  createRouteSchema,
  updateRouteSchema,
  routeFilterSchema,
} from '../schemas/route.schemas.js';
import {
  createGeofenceSchema,
  updateGeofenceSchema,
  geofenceFilterSchema,
} from '../schemas/geofence.schemas.js';
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhookFilterSchema,
} from '../schemas/webhook.schemas.js';
import {
  createUserSchema,
  updateUserSchema,
  userFilterSchema,
} from '../schemas/user.schemas.js';
import {
  createNotificationSchema,
  notificationFilterSchema,
} from '../schemas/notification.schemas.js';

// Auth
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// Shipment
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type ShipmentActionInput = z.infer<typeof shipmentActionSchema>;
export type ShipmentFilter = z.infer<typeof shipmentFilterSchema>;

// Vehicle
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type VehicleFilter = z.infer<typeof vehicleFilterSchema>;

// Driver
export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type DriverFilter = z.infer<typeof driverFilterSchema>;

// Route
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type RouteFilter = z.infer<typeof routeFilterSchema>;

// Geofence
export type CreateGeofenceInput = z.infer<typeof createGeofenceSchema>;
export type UpdateGeofenceInput = z.infer<typeof updateGeofenceSchema>;
export type GeofenceFilter = z.infer<typeof geofenceFilterSchema>;

// Webhook
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type WebhookFilter = z.infer<typeof webhookFilterSchema>;

// User
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserFilter = z.infer<typeof userFilterSchema>;

// Notification
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type NotificationFilter = z.infer<typeof notificationFilterSchema>;
