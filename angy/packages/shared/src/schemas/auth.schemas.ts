import { z } from 'zod';

export const registerSchema = z.object({
  tenant_name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});
