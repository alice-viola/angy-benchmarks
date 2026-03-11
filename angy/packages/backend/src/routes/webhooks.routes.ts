import type { FastifyInstance } from 'fastify';
import { createWebhookSchema, updateWebhookSchema, webhookFilterSchema } from '@nexus-fleet/shared';
import * as webhookService from '../services/webhook.service.js';
import { ServiceError } from '../services/vehicle.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export default async function webhookRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const query = webhookFilterSchema.parse(request.query);
    const result = await webhookService.list({
      tenantId: request.user.tenantId,
      is_active: query.is_active,
      page: query.page,
      limit: query.limit,
    });

    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  app.get('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const webhook = await webhookService.getById(request.user.tenantId, id);
    return reply.send({ success: true, data: webhook });
  });

  app.post('/', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const body = createWebhookSchema.parse(request.body);
    const webhook = await webhookService.create(request.user.tenantId, body);
    return reply.status(201).send({ success: true, data: webhook });
  });

  app.put('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateWebhookSchema.parse(request.body);
    const webhook = await webhookService.update(request.user.tenantId, id, body);
    return reply.send({ success: true, data: webhook });
  });

  app.delete('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await webhookService.softDelete(request.user.tenantId, id);
    return reply.send({ success: true, data: result });
  });

  app.post('/:id/test', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await webhookService.testWebhook(request.user.tenantId, id);
    return reply.send({ success: true, data: result });
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof ServiceError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: (error as any).issues },
      });
    }
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
}
