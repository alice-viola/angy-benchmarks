import { z } from 'zod';
import { ROLES } from '../constants/roles.js';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  role: z.enum(ROLES).optional(),
});

export const userFilterSchema = z.object({
  role: z.enum(ROLES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
