import { z } from 'zod';
import {
  VEHICLE_TYPES,
  CARGO_TYPES,
  PRIORITIES,
  STOP_TYPES,
  USER_ROLES,
} from '../constants/index.js';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  tenantName: z.string().min(2).max(255),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      'Password must contain uppercase, lowercase, number, and special character',
    ),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
});

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export const vehicleCreateSchema = z.object({
  registration: z.string().min(1).max(50),
  vin: z.string().length(17),
  make: z.string().min(1).max(255),
  model: z.string().min(1).max(255),
  year: z.number().int().min(1990).max(2030),
  type: z.enum(VEHICLE_TYPES),
  capacity_kg: z.number().positive(),
  capacity_m3: z.number().positive(),
});

export const vehicleUpdateSchema = vehicleCreateSchema.partial();

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export const driverCreateSchema = z.object({
  employee_id: z.string().min(1).max(100),
  first_name: z.string().min(1).max(255),
  last_name: z.string().min(1).max(255),
  phone: z.string().min(1).max(50),
  license_number: z.string().min(1).max(100),
  license_expiry: z.string(), // date string
  license_classes: z.array(z.string()),
  max_driving_hours_day: z.number().min(1).max(15).default(9),
});

export const driverUpdateSchema = driverCreateSchema.partial();

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

export const shipmentCreateSchema = z
  .object({
    customer_name: z.string().min(1).max(255),
    origin_address: z.string().min(1).max(500),
    origin_lat: z.number().min(-90).max(90),
    origin_lng: z.number().min(-180).max(180),
    dest_address: z.string().min(1).max(500),
    dest_lat: z.number().min(-90).max(90),
    dest_lng: z.number().min(-180).max(180),
    cargo_description: z.string().min(1).max(1000),
    cargo_weight_kg: z.number().positive(),
    cargo_volume_m3: z.number().positive(),
    cargo_type: z.enum(CARGO_TYPES),
    requires_temp_control: z.boolean().default(false),
    temp_min_c: z.number().optional(),
    temp_max_c: z.number().optional(),
    priority: z.enum(PRIORITIES).default('normal'),
    scheduled_pickup_at: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.requires_temp_control) {
        return data.temp_min_c !== undefined && data.temp_max_c !== undefined;
      }
      return true;
    },
    {
      message:
        'temp_min_c and temp_max_c are required when requires_temp_control is true',
      path: ['temp_min_c'],
    },
  )
  .refine(
    (data) => {
      if (
        data.temp_min_c !== undefined &&
        data.temp_max_c !== undefined
      ) {
        return data.temp_min_c < data.temp_max_c;
      }
      return true;
    },
    {
      message: 'temp_min_c must be less than temp_max_c',
      path: ['temp_max_c'],
    },
  );

export const shipmentUpdateSchema = z.object({
  customer_name: z.string().min(1).max(255).optional(),
  origin_address: z.string().min(1).max(500).optional(),
  origin_lat: z.number().min(-90).max(90).optional(),
  origin_lng: z.number().min(-180).max(180).optional(),
  dest_address: z.string().min(1).max(500).optional(),
  dest_lat: z.number().min(-90).max(90).optional(),
  dest_lng: z.number().min(-180).max(180).optional(),
  cargo_description: z.string().min(1).max(1000).optional(),
  cargo_weight_kg: z.number().positive().optional(),
  cargo_volume_m3: z.number().positive().optional(),
  cargo_type: z.enum(CARGO_TYPES).optional(),
  requires_temp_control: z.boolean().optional(),
  temp_min_c: z.number().optional(),
  temp_max_c: z.number().optional(),
  priority: z.enum(PRIORITIES).optional(),
  scheduled_pickup_at: z.string().optional(),
});

export const shipmentTransitionSchema = z.object({
  action: z.enum([
    'confirm',
    'assign',
    'pickup',
    'deliver',
    'fail',
    'complete',
    'cancel',
  ]),
  data: z.record(z.any()).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const routeStopSchema = z.object({
  shipment_id: z.string().uuid().optional(),
  stop_type: z.enum(STOP_TYPES),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
  address: z.string().min(1).max(500),
  sequence_order: z.number().int().min(0),
});

export const routeCreateSchema = z.object({
  name: z.string().min(1).max(255),
  vehicle_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  planned_date: z.string(),
  stops: z.array(routeStopSchema).optional(),
});

// ---------------------------------------------------------------------------
// Geofences
// ---------------------------------------------------------------------------

export const geofenceCreateSchema = z.object({
  name: z.string().min(1).max(255),
  center_lat: z.number().min(-90).max(90),
  center_lng: z.number().min(-180).max(180),
  radius_m: z.number().positive(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#3B82F6'),
  trigger_on_enter: z.boolean().default(true),
  trigger_on_exit: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export const webhookCreateSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(z.string()).min(1),
  is_active: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(USER_ROLES),
  first_name: z.string().min(1).max(255),
  last_name: z.string().min(1).max(255),
});

// ---------------------------------------------------------------------------
// Location / Telemetry
// ---------------------------------------------------------------------------

export const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed_kmh: z.number().min(0).max(300),
  heading: z.number().min(0).max(360),
  timestamp: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
