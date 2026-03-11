import type { FastifyInstance } from 'fastify';
import { createUserSchema, updateUserSchema, userFilterSchema } from '@nexus-fleet/shared';
import * as userService from '../services/user.service.js';
import { ServiceError } from '../services/vehicle.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export default async function userRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const query = userFilterSchema.parse(request.query);
    const result = await userService.list({
      tenantId: request.user.tenantId,
      role: query.role,
      page: query.page,
      limit: query.limit,
    });

    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  app.get('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await userService.getById(request.user.tenantId, id);
    return reply.send({ success: true, data: user });
  });

  app.post('/', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    const user = await userService.create(
      request.user.tenantId,
      body,
      request.user.role,
    );
    return reply.status(201).send({ success: true, data: user });
  });

  app.put('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateUserSchema.parse(request.body);
    const user = await userService.update(
      request.user.tenantId,
      id,
      body,
      request.user.userId,
      request.user.role,
    );
    return reply.send({ success: true, data: user });
  });

  app.delete('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await userService.softDelete(
      request.user.tenantId,
      id,
      request.user.userId,
    );
    return reply.send({ success: true, data: user });
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
