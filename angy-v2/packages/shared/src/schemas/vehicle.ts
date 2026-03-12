import { z } from 'zod';

export const vehicleTypeEnum = z.enum(['van', 'truck', 'semi', 'refrigerated']);

export const vehicleRequestSchema = z.object({
  registration: z.string().min(1),
  vin: z.string().length(17, 'VIN must be exactly 17 characters'),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1990).max(2030),
  type: vehicleTypeEnum,
  capacity_kg: z.number().positive(),
  capacity_m3: z.number().positive(),
});

export const vehicleUpdateRequestSchema = z.object({
  registration: z.string().min(1).optional(),
  vin: z.string().length(17, 'VIN must be exactly 17 characters').optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1990).max(2030).optional(),
  type: vehicleTypeEnum.optional(),
  capacity_kg: z.number().positive().optional(),
  capacity_m3: z.number().positive().optional(),
});

export const vehicleResponseSchema = z.object({
  id: z.string().uuid(),
  registration: z.string(),
  vin: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number(),
  type: z.string(),
  capacity_kg: z.number(),
  capacity_m3: z.number(),
  status: z.string(),
  last_location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  last_location_at: z.string().nullable(),
  last_speed_kmh: z.number().nullable(),
  heading: z.number().nullable(),
  assigned_driver_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});
