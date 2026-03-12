import { z } from 'zod';

export const geofenceRequestSchema = z.object({
  name: z.string().min(1).max(255),
  center_lat: z.number().min(-90).max(90),
  center_lng: z.number().min(-180).max(180),
  radius_m: z.number().positive(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 7-character hex color')
    .default('#3B82F6')
    .optional(),
  trigger_on_enter: z.boolean().default(true).optional(),
  trigger_on_exit: z.boolean().default(true).optional(),
});

export const geofenceUpdateRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  center_lat: z.number().min(-90).max(90).optional(),
  center_lng: z.number().min(-180).max(180).optional(),
  radius_m: z.number().positive().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 7-character hex color')
    .optional(),
  trigger_on_enter: z.boolean().optional(),
  trigger_on_exit: z.boolean().optional(),
});

export const geofenceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  center: z.object({ lat: z.number(), lng: z.number() }),
  radius_m: z.number(),
  color: z.string(),
  trigger_on_enter: z.boolean(),
  trigger_on_exit: z.boolean(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const geofenceEventResponseSchema = z.object({
  id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  vehicle: z.object({ registration: z.string() }),
  event_type: z.enum(['enter', 'exit']),
  location: z.object({ lat: z.number(), lng: z.number() }),
  triggered_at: z.string(),
  acknowledged_at: z.string().nullable(),
  acknowledged_by: z.string().uuid().nullable(),
});
