import { z } from 'zod';

const waypointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(500).optional(),
  order: z.number().int().min(0),
});

export const createRouteSchema = z.object({
  name: z.string().min(1).max(100),
  driver_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  waypoints: z.array(waypointSchema).min(2),
  scheduled_start_at: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateRouteSchema = createRouteSchema.partial();

export const routeFilterSchema = z.object({
  driver_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
