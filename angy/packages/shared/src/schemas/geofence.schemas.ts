import { z } from 'zod';

const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createGeofenceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['circle', 'polygon']),
  center_latitude: z.number().min(-90).max(90).optional(),
  center_longitude: z.number().min(-180).max(180).optional(),
  radius_meters: z.number().positive().optional(),
  polygon_coordinates: z.array(coordinateSchema).min(3).optional(),
  trigger_on_enter: z.boolean().default(true),
  trigger_on_exit: z.boolean().default(true),
});

export const updateGeofenceSchema = createGeofenceSchema.partial();

export const geofenceFilterSchema = z.object({
  type: z.enum(['circle', 'polygon']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
