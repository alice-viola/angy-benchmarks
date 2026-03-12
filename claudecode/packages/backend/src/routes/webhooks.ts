import type { FastifyPluginAsync } from 'fastify';
import { eq, and, count, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { webhookEndpoints } from '../db/schema.js';
import { authorize } from '../middleware/authorize.js';
import { webhookCreateSchema, paginationSchema } from '@nexus-fleet/shared';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET / - List webhook endpoints
  // -------------------------------------------------------------------------
  fastify.get(
    '/',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const query = request.query as Record<string, string>;

      const pagination = paginationSchema.parse({
        page: query.page,
        pageSize: query.pageSize,
      });

      const offset = (pagination.page - 1) * pagination.pageSize;

      const [items, [totalResult]] = await Promise.all([
        db
          .select()
          .from(webhookEndpoints)
          .where(eq(webhookEndpoints.tenant_id, tenantId))
          .orderBy(desc(webhookEndpoints.created_at))
          .limit(pagination.pageSize)
          .offset(offset),
        db
          .select({ count: count() })
          .from(webhookEndpoints)
          .where(eq(webhookEndpoints.tenant_id, tenantId)),
      ]);

      // Don't expose secrets
      const sanitized = items.map(({ secret, ...rest }) => rest);

      return reply.send({
        success: true,
        data: sanitized,
        meta: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalItems: totalResult?.count ?? 0,
          totalPages: Math.ceil((totalResult?.count ?? 0) / pagination.pageSize),
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST / - Create webhook endpoint
  // -------------------------------------------------------------------------
  fastify.post(
    '/',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const parsed = webhookCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const secret = crypto.randomBytes(32).toString('hex');

      const [endpoint] = await db
        .insert(webhookEndpoints)
        .values({
          tenant_id: tenantId,
          url: parsed.data.url,
          events: parsed.data.events,
          is_active: parsed.data.is_active,
          secret,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          ...endpoint,
          // Only show secret on creation
          secret,
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id
  // -------------------------------------------------------------------------
  fastify.get(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(
          and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)),
        )
        .limit(1);

      if (!endpoint) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' },
        });
      }

      const { secret, ...rest } = endpoint;
      return reply.send({ success: true, data: rest });
    },
  );

  // -------------------------------------------------------------------------
  // PUT /:id
  // -------------------------------------------------------------------------
  fastify.put(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(webhookEndpoints)
        .where(
          and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' },
        });
      }

      const body = request.body as Record<string, any>;
      const updateData: Record<string, any> = { updated_at: new Date() };

      if (body.url !== undefined) updateData.url = body.url;
      if (body.events !== undefined) updateData.events = body.events;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const [updated] = await db
        .update(webhookEndpoints)
        .set(updateData)
        .where(
          and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)),
        )
        .returning();

      const { secret, ...rest } = updated;
      return reply.send({ success: true, data: rest });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /:id
  // -------------------------------------------------------------------------
  fastify.delete(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(
          and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' },
        });
      }

      await db
        .delete(webhookEndpoints)
        .where(
          and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)),
        );

      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // POST /:id/test - Send test webhook
  // -------------------------------------------------------------------------
  fastify.post(
    '/:id/test',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(
          and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenant_id, tenantId)),
        )
        .limit(1);

      if (!endpoint) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' },
        });
      }

      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from NexusFleet',
          tenant_id: tenantId,
        },
      };

      const payloadStr = JSON.stringify(testPayload);
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(payloadStr)
        .digest('hex');

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NexusFleet-Signature': signature,
            'X-NexusFleet-Event': 'test',
          },
          body: payloadStr,
          signal: AbortSignal.timeout(10000),
        });

        return reply.send({
          success: true,
          data: {
            status: response.status,
            statusText: response.statusText,
            delivered: response.ok,
          },
        });
      } catch (err: any) {
        return reply.send({
          success: true,
          data: {
            status: 0,
            statusText: err.message,
            delivered: false,
          },
        });
      }
    },
  );
};
