import { z } from 'zod';

export const cargoTypeEnum = z.enum(['general', 'fragile', 'hazardous', 'perishable']);
export const priorityEnum = z.enum(['low', 'normal', 'high', 'critical']);

export const shipmentRequestSchema = z
  .object({
    customer_name: z.string().min(1).max(255),
    origin_address: z.string().min(1),
    origin_lat: z.number().min(-90).max(90),
    origin_lng: z.number().min(-180).max(180),
    dest_address: z.string().min(1),
    dest_lat: z.number().min(-90).max(90),
    dest_lng: z.number().min(-180).max(180),
    cargo_description: z.string().min(1),
    cargo_weight_kg: z.number().positive(),
    cargo_volume_m3: z.number().positive(),
    cargo_type: cargoTypeEnum,
    priority: priorityEnum.default('normal').optional(),
    requires_temp_control: z.boolean().default(false).optional(),
    temp_min_c: z.number().optional(),
    temp_max_c: z.number().optional(),
    scheduled_pickup_at: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.requires_temp_control) {
        return data.temp_min_c !== undefined && data.temp_max_c !== undefined;
      }
      return true;
    },
    { message: 'temp_min_c and temp_max_c are required when requires_temp_control is true', path: ['temp_min_c'] }
  )
  .refine(
    (data) => {
      if (data.temp_min_c !== undefined && data.temp_max_c !== undefined) {
        return data.temp_max_c > data.temp_min_c;
      }
      return true;
    },
    { message: 'temp_max_c must be greater than temp_min_c', path: ['temp_max_c'] }
  );

export const shipmentUpdateRequestSchema = z
  .object({
    customer_name: z.string().min(1).max(255).optional(),
    origin_address: z.string().min(1).optional(),
    origin_lat: z.number().min(-90).max(90).optional(),
    origin_lng: z.number().min(-180).max(180).optional(),
    dest_address: z.string().min(1).optional(),
    dest_lat: z.number().min(-90).max(90).optional(),
    dest_lng: z.number().min(-180).max(180).optional(),
    cargo_description: z.string().min(1).optional(),
    cargo_weight_kg: z.number().positive().optional(),
    cargo_volume_m3: z.number().positive().optional(),
    cargo_type: cargoTypeEnum.optional(),
    priority: priorityEnum.optional(),
    requires_temp_control: z.boolean().optional(),
    temp_min_c: z.number().optional(),
    temp_max_c: z.number().optional(),
    scheduled_pickup_at: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.temp_min_c !== undefined && data.temp_max_c !== undefined) {
        return data.temp_max_c > data.temp_min_c;
      }
      return true;
    },
    { message: 'temp_max_c must be greater than temp_min_c', path: ['temp_max_c'] }
  );

export const transitionActionEnum = z.enum([
  'confirm',
  'assign',
  'pickup',
  'deliver',
  'fail',
  'complete',
  'cancel',
  'retry',
]);

export const shipmentTransitionRequestSchema = z.object({
  action: transitionActionEnum,
  data: z
    .object({
      vehicle_id: z.string().uuid().optional(),
      driver_id: z.string().uuid().optional(),
      pod_signature_url: z.string().url().optional(),
      pod_photo_urls: z.array(z.string().url()).optional(),
      failure_reason: z.string().min(1).optional(),
      cancellation_reason: z.string().min(1).optional(),
    })
    .optional(),
});

export const shipmentResponseSchema = z.object({
  id: z.string().uuid(),
  reference_code: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  customer_name: z.string(),
  origin_address: z.string(),
  origin_location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  dest_address: z.string(),
  dest_location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  cargo_description: z.string(),
  cargo_weight_kg: z.number(),
  cargo_volume_m3: z.number(),
  cargo_type: z.string(),
  requires_temp_control: z.boolean(),
  temp_min_c: z.number().nullable(),
  temp_max_c: z.number().nullable(),
  assigned_vehicle_id: z.string().uuid().nullable(),
  assigned_driver_id: z.string().uuid().nullable(),
  assigned_route_id: z.string().uuid().nullable().optional(),
  assigned_vehicle: z
    .object({
      id: z.string().uuid(),
      registration: z.string(),
      make: z.string(),
      model: z.string(),
      type: z.string(),
    })
    .nullable()
    .optional(),
  assigned_driver: z
    .object({
      id: z.string().uuid(),
      first_name: z.string(),
      last_name: z.string(),
      phone: z.string(),
    })
    .nullable()
    .optional(),
  scheduled_pickup_at: z.string().nullable(),
  actual_pickup_at: z.string().nullable().optional(),
  actual_delivery_at: z.string().nullable().optional(),
  estimated_arrival_at: z.string().nullable().optional(),
  pod_signature_url: z.string().nullable().optional(),
  pod_photo_urls: z.array(z.string()).nullable().optional(),
  pod_notes: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  created_by: z.string().uuid().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const shipmentEventResponseSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  from_status: z.string().nullable(),
  to_status: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.any()),
  created_by: z
    .object({
      id: z.string().uuid(),
      first_name: z.string(),
      last_name: z.string(),
    })
    .nullable(),
  created_at: z.string(),
});
