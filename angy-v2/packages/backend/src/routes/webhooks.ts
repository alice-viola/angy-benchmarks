import { FastifyInstance } from 'fastify';
import { webhookRequestSchema, webhookUpdateRequestSchema } from '@nexusfleet/shared';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { webhookEndpoints } from '../db/schema.js';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

export async function webhookRoutes(app: FastifyInstance) {
  // GET /api/v1/webhooks
  app.get('/', async (request) => {
    const query = request.query as Record<string, string>;
    const page = query.page ? Number(query.page) : 1;
    const page_size = query.page_size ? Math.min(Number(query.page_size), 100) : 25;
    const offset = (page - 1) * page_size;

    const whereClause = eq(webhookEndpoints.tenant_id, request.user.tenant_id);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookEndpoints)
      .where(whereClause);

    const rows = await db
      .select()
      .from(webhookEndpoints)
      .where(whereClause)
      .orderBy(desc(webhookEndpoints.created_at))
      .limit(page_size)
      .offset(offset);

    const data = rows.map(formatWebhook);

    return {
      success: true,
      data,
      meta: {
        page,
        page_size,
        total_items: count,
        total_pages: Math.ceil(count / page_size),
      },
    };
  });

  // POST /api/v1/webhooks
  app.post('/', async (request, reply) => {
    const parsed = webhookRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const secret_hash = await bcrypt.hash(secret, 12);

    const [row] = await db
      .insert(webhookEndpoints)
      .values({
        tenant_id: request.user.tenant_id,
        created_by: request.user.id,
        url: parsed.data.url,
        events: parsed.data.events,
        secret,
        secret_hash,
      })
      .returning();

    return reply.status(201).send({
      success: true,
      data: {
        ...formatWebhook(row),
        secret,
      },
    });
  });

  // PUT /api/v1/webhooks/:id
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = webhookUpdateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const updateData: Record<string, any> = { updated_at: new Date() };
    if (parsed.data.url !== undefined) updateData.url = parsed.data.url;
    if (parsed.data.events !== undefined) updateData.events = parsed.data.events;
    if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active;

    const [updated] = await db
      .update(webhookEndpoints)
      .set(updateData)
      .where(
        and(
          eq(webhookEndpoints.id, request.params.id),
          eq(webhookEndpoints.tenant_id, request.user.tenant_id),
        ),
      )
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found', details: null },
      });
    }

    return { success: true, data: formatWebhook(updated) };
  });

  // DELETE /api/v1/webhooks/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const [deleted] = await db
      .delete(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, request.params.id),
          eq(webhookEndpoints.tenant_id, request.user.tenant_id),
        ),
      )
      .returning({ id: webhookEndpoints.id });

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found', details: null },
      });
    }

    return { success: true, data: null };
  });
}

function formatWebhook(w: typeof webhookEndpoints.$inferSelect) {
  return {
    id: w.id,
    url: w.url,
    events: w.events ?? [],
    is_active: w.is_active ?? true,
    failure_count: w.failure_count ?? 0,
    created_at: w.created_at?.toISOString() ?? '',
    updated_at: w.updated_at?.toISOString() ?? '',
  };
}
