import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, count, desc } from 'drizzle-orm';
import { randomBytes, createHmac } from 'node:crypto';
import { db } from '../db/connection.js';
import { webhookEndpoints } from '../db/schema.js';
import {
  createWebhookSchema,
  updateWebhookSchema,
  paginationSchema,
} from '@nexus-fleet/shared';

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    const { role } = request.user!;
    if (role !== 'owner' && role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only owner or admin can manage webhooks' },
      });
    }
  });

  // GET / – list webhook endpoints
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { page, limit } = paginationSchema.parse(request.query);
    const offset = (page - 1) * limit;

    const where = eq(webhookEndpoints.tenantId, tenantId);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(webhookEndpoints)
        .where(where)
        .orderBy(desc(webhookEndpoints.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(webhookEndpoints).where(where),
    ]);

    // Mask secrets in response
    const masked = rows.map((r) => ({
      ...r,
      secret: r.secret.slice(0, 8) + '••••••••',
    }));

    return reply.send({
      success: true,
      data: masked,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  });

  // POST / – create webhook endpoint
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const body = createWebhookSchema.parse(request.body);

    const secret = randomBytes(32).toString('hex');

    const [endpoint] = await db
      .insert(webhookEndpoints)
      .values({
        tenantId,
        url: body.url,
        secret,
        events: body.events,
        isActive: body.isActive,
      })
      .returning();

    return reply.status(201).send({ success: true, data: { ...endpoint, secret } });
  });

  // PUT /:id – update webhook endpoint
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;
    const body = updateWebhookSchema.parse(request.body);

    const [existing] = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' },
      });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (body.url) updateValues.url = body.url;
    if (body.events) updateValues.events = body.events;
    if (body.isActive !== undefined) updateValues.isActive = body.isActive;

    const [updated] = await db
      .update(webhookEndpoints)
      .set(updateValues)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)))
      .returning();

    return reply.send({
      success: true,
      data: { ...updated, secret: updated.secret.slice(0, 8) + '••••••••' },
    });
  });

  // DELETE /:id – delete webhook endpoint
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [existing] = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' },
      });
    }

    await db
      .delete(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)));

    return reply.send({ success: true, data: { id } });
  });

  // POST /:id/test – send test webhook
  fastify.post(
    '/:id/test',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenantId } = request.user!;
      const { id } = request.params;

      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)));

      if (!endpoint) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' },
        });
      }

      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a test webhook delivery' },
      };

      const payloadStr = JSON.stringify(testPayload);
      const signature = createHmac('sha256', endpoint.secret)
        .update(payloadStr)
        .digest('hex');

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NexusFleet-Signature': `sha256=${signature}`,
            'X-NexusFleet-Event': 'test',
          },
          body: payloadStr,
          signal: AbortSignal.timeout(10_000),
        });

        return reply.send({
          success: true,
          data: {
            delivered: response.ok,
            statusCode: response.status,
            statusText: response.statusText,
          },
        });
      } catch (err: any) {
        return reply.send({
          success: true,
          data: {
            delivered: false,
            error: err.message || 'Request failed',
          },
        });
      }
    },
  );
}
