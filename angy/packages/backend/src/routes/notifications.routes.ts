import type { FastifyInstance } from 'fastify';
import { notificationFilterSchema } from '@nexus-fleet/shared';
import * as notificationService from '../services/notification.service.js';
import { ServiceError } from '../services/vehicle.service.js';

export default async function notificationRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const query = notificationFilterSchema.parse(request.query);
    const result = await notificationService.list({
      tenantId: request.user.tenantId,
      userId: request.user.userId,
      is_read: query.is_read,
      page: query.page,
      limit: query.limit,
    });

    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  app.put('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const notification = await notificationService.markAsRead(
      request.user.tenantId,
      request.user.userId,
      id,
    );
    return reply.send({ success: true, data: notification });
  });

  app.put('/read-all', async (request, reply) => {
    const result = await notificationService.markAllAsRead(
      request.user.tenantId,
      request.user.userId,
    );
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
