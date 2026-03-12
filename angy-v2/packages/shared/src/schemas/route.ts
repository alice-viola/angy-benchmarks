import { z } from 'zod';

export const stopTypeEnum = z.enum(['pickup', 'delivery', 'depot']);

export const routeStopRequestSchema = z.object({
  shipment_id: z.string().uuid().optional(),
  stop_type: stopTypeEnum,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1),
  sequence_order: z.number().int().min(0),
});

export const routeRequestSchema = z.object({
  name: z.string().min(1).max(255),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  vehicle_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  stops: z.array(routeStopRequestSchema).optional(),
});

export const routeUpdateRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vehicle_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  stops: z.array(routeStopRequestSchema).optional(),
});

export const bulkStopReorderRequestSchema = z.object({
  stops: z.array(
    z.object({
      id: z.string().uuid(),
      sequence_order: z.number().int().min(0),
    })
  ),
});

export const stopCompleteRequestSchema = z.object({
  pod_signature_url: z.string().url().optional(),
  pod_photo_urls: z.array(z.string().url()).optional(),
  pod_notes: z.string().optional(),
});

export const routeResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.string(),
  vehicle_id: z.string().uuid().nullable(),
  driver_id: z.string().uuid().nullable(),
  planned_date: z.string(),
  estimated_distance_km: z.number().nullable(),
  optimization_score: z.number().nullable(),
  polyline: z.any().nullable().optional(),
  vehicle: z
    .object({
      id: z.string().uuid(),
      registration: z.string(),
      make: z.string(),
      model: z.string(),
      capacity_kg: z.number(),
      capacity_m3: z.number(),
    })
    .nullable()
    .optional(),
  driver: z
    .object({
      id: z.string().uuid(),
      first_name: z.string(),
      last_name: z.string(),
    })
    .nullable()
    .optional(),
  stops: z
    .array(
      z.object({
        id: z.string().uuid(),
        shipment_id: z.string().uuid().nullable(),
        stop_type: z.string(),
        sequence_order: z.number(),
        location: z.object({ lat: z.number(), lng: z.number() }),
        address: z.string(),
        planned_arrival: z.string().nullable(),
        actual_arrival: z.string().nullable(),
        status: z.string(),
      })
    )
    .optional(),
  stops_count: z.number().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
