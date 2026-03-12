import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerRequestSchema = z.object({
  tenant_name: z.string().min(1).max(255),
  tenant_slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  email: z.string().email(),
  password: passwordSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.string(),
    first_name: z.string(),
    last_name: z.string(),
  }),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  access_token: z.string(),
});

export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    tenant_id: z.string().uuid(),
  }),
  access_token: z.string(),
});

export const refreshResponseSchema = z.object({
  access_token: z.string(),
});

export const meResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  tenant_id: z.string().uuid(),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    plan: z.string(),
  }),
});
