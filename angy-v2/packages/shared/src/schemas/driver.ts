import { z } from 'zod';

export const licenseClassEnum = z.enum(['B', 'C', 'CE']);

export const driverRequestSchema = z.object({
  employee_id: z.string().min(1),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: z.string().min(1),
  license_number: z.string().min(1),
  license_expiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .refine((val) => new Date(val) > new Date(), { message: 'License expiry must be in the future' }),
  license_classes: z.array(licenseClassEnum).nonempty('At least one license class is required'),
  max_driving_hours_day: z.number().positive().default(9.0).optional(),
});

export const driverStatusEnum = z.enum(['off_duty', 'available', 'driving', 'resting']);

export const driverUpdateRequestSchema = z.object({
  employee_id: z.string().min(1).optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).optional(),
  license_number: z.string().min(1).optional(),
  license_expiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .refine((val) => new Date(val) > new Date(), { message: 'License expiry must be in the future' })
    .optional(),
  license_classes: z.array(licenseClassEnum).nonempty().optional(),
  max_driving_hours_day: z.number().positive().optional(),
  status: driverStatusEnum.optional(),
});

export const assignVehicleRequestSchema = z.object({
  vehicle_id: z.string().uuid(),
});

export const driverResponseSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string(),
  license_number: z.string(),
  license_expiry: z.string(),
  license_classes: z.array(z.string()),
  status: z.string(),
  current_vehicle_id: z.string().uuid().nullable(),
  max_driving_hours_day: z.number(),
  current_driving_hours: z.number(),
  is_active: z.boolean(),
});
