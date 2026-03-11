import { z } from 'zod';
import { SHIPMENT_STATES, SHIPMENT_ACTIONS } from '../constants/shipment-states.js';

export const createShipmentSchema = z.object({
  reference_code: z.string().min(1).max(50).optional(),
  customer_name: z.string().min(1).max(255),
  origin_address: z.string().min(1).max(500),
  origin_lat: z.number().min(-90).max(90),
  origin_lng: z.number().min(-180).max(180),
  dest_address: z.string().min(1).max(500),
  dest_lat: z.number().min(-90).max(90),
  dest_lng: z.number().min(-180).max(180),
  scheduled_pickup_at: z.string().datetime().optional(),
  scheduled_delivery_at: z.string().datetime().optional(),
  cargo_description: z.string().max(2000).optional(),
  cargo_weight_kg: z.number().positive(),
  cargo_volume_m3: z.number().positive(),
  cargo_type: z.enum(['general', 'fragile', 'hazardous', 'perishable', 'oversized']).optional(),
  requires_temp_control: z.boolean().optional(),
  temp_min_c: z.number().optional(),
  temp_max_c: z.number().optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateShipmentSchema = createShipmentSchema.partial();

export const shipmentActionSchema = z.object({
  action: z.enum(SHIPMENT_ACTIONS),
  driver_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  pod_signature_url: z.string().url().optional(),
  pod_photo_urls: z.array(z.string().url()).optional(),
  pod_notes: z.string().max(2000).optional(),
  failure_reason: z.string().max(2000).optional(),
  cancellation_reason: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const shipmentFilterSchema = z.object({
  status: z.enum(SHIPMENT_STATES).optional(),
  driver_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
