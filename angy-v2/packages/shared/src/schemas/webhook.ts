import { z } from 'zod';

export const webhookEventEnum = z.enum([
  'shipment.status_changed',
  'shipment.completed',
  'shipment.failed',
  'geofence.triggered',
]);

export const webhookRequestSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(webhookEventEnum).nonempty('At least one event is required'),
});

export const webhookUpdateRequestSchema = z.object({
  url: z.string().url().max(2000).optional(),
  events: z.array(webhookEventEnum).nonempty().optional(),
  is_active: z.boolean().optional(),
});

export const webhookResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  events: z.array(z.string()),
  is_active: z.boolean(),
  secret: z.string().optional(),
  failure_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const webhookTestResponseSchema = z.object({
  delivered: z.boolean(),
  status_code: z.number().nullable(),
  response_time_ms: z.number().nullable(),
});
