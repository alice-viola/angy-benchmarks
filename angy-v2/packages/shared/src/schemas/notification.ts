import { z } from 'zod';

export const notificationResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.any()),
  read_at: z.string().nullable(),
  created_at: z.string(),
});

export const notificationListMetaSchema = z.object({
  page: z.number().int(),
  page_size: z.number().int(),
  total_items: z.number().int(),
  total_pages: z.number().int(),
  unread_count: z.number().int(),
});

export const markAllReadResponseSchema = z.object({
  updated_count: z.number().int(),
});
