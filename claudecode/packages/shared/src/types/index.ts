import { z } from 'zod';
import type {
  loginSchema,
  registerSchema,
  vehicleCreateSchema,
  vehicleUpdateSchema,
  driverCreateSchema,
  driverUpdateSchema,
  shipmentCreateSchema,
  shipmentUpdateSchema,
  shipmentTransitionSchema,
  routeCreateSchema,
  routeStopSchema,
  geofenceCreateSchema,
  webhookCreateSchema,
  userCreateSchema,
  locationUpdateSchema,
  paginationSchema,
} from '../schemas/index.js';

// ---------------------------------------------------------------------------
// Inferred types from Zod schemas
// ---------------------------------------------------------------------------

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;

export type DriverCreateInput = z.infer<typeof driverCreateSchema>;
export type DriverUpdateInput = z.infer<typeof driverUpdateSchema>;

export type ShipmentCreateInput = z.infer<typeof shipmentCreateSchema>;
export type ShipmentUpdateInput = z.infer<typeof shipmentUpdateSchema>;
export type ShipmentTransitionInput = z.infer<typeof shipmentTransitionSchema>;

export type RouteCreateInput = z.infer<typeof routeCreateSchema>;
export type RouteStopInput = z.infer<typeof routeStopSchema>;

export type GeofenceCreateInput = z.infer<typeof geofenceCreateSchema>;

export type WebhookCreateInput = z.infer<typeof webhookCreateSchema>;

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;

export type PaginationInput = z.infer<typeof paginationSchema>;

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type ApiResponse<T> =
  | { success: true; data: T; meta?: PaginationMeta }
  | {
      success: false;
      error: { code: string; message: string; details?: any };
    };

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

export interface WsMessage {
  type: string;
  data?: any;
}

// ---------------------------------------------------------------------------
// Vehicle location (real-time telemetry)
// ---------------------------------------------------------------------------

export interface VehicleLocation {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  timestamp: string;
}
