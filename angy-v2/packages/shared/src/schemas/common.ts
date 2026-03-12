import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  page_size: z.number().int(),
  total_items: z.number().int(),
  total_pages: z.number().int(),
});

export function successResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().nullable(),
  }),
});

export const sortQuerySchema = z.object({
  sort: z.string().optional().default('-created_at'),
});
