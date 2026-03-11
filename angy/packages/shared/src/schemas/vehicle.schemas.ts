import { z } from 'zod';
import { VEHICLE_TYPES } from '../constants/vehicle-types.js';
import { VEHICLE_STATUSES } from '../constants/vehicle-statuses.js';

export const createVehicleSchema = z.object({
  plate_number: z.string().min(1).max(20),
  vehicle_type: z.enum(VEHICLE_TYPES),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1900).max(2100),
  max_weight_kg: z.number().positive().optional(),
  max_volume_m3: z.number().positive().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  status: z.enum(VEHICLE_STATUSES).optional(),
});

export const vehicleFilterSchema = z.object({
  vehicle_type: z.enum(VEHICLE_TYPES).optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
