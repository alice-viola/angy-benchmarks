import { z } from 'zod';
import { DRIVER_STATUSES } from '../constants/driver-statuses.js';

export const createDriverSchema = z.object({
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().min(1).max(20),
  license_number: z.string().min(1).max(50),
  license_class: z.string().min(1).max(10),
});

export const updateDriverSchema = createDriverSchema.partial().extend({
  status: z.enum(DRIVER_STATUSES).optional(),
});

export const driverFilterSchema = z.object({
  status: z.enum(DRIVER_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
