import { z } from 'zod';

export const userCreateRequestSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  role: z.enum(['admin', 'dispatcher', 'viewer']),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
});

export const userUpdateRequestSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(['admin', 'dispatcher', 'viewer']).optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
});

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
});
