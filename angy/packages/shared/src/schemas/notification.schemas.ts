import { z } from 'zod';

export const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  type: z.enum(['info', 'warning', 'error', 'success']),
  target_user_id: z.string().uuid().optional(),
});

export const notificationFilterSchema = z.object({
  is_read: z.coerce.boolean().optional(),
  type: z.enum(['info', 'warning', 'error', 'success']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
