import type { FastifyInstance } from 'fastify';
import { createDriverSchema, updateDriverSchema, driverFilterSchema } from '@nexus-fleet/shared';
import * as driverService from '../services/driver.service.js';
import { ServiceError } from '../services/vehicle.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { z } from 'zod';

export default async function driverRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const query = driverFilterSchema.parse(request.query);
    const q = request.query as any;
    const result = await driverService.list({
      tenantId: request.user.tenantId,
      status: q.status,
      search: q.search,
      sort: q.sort,
      order: q.order,
      page: query.page,
      limit: query.limit,
    });

    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const driver = await driverService.getById(request.user.tenantId, id);
    return reply.send({ success: true, data: driver });
  });

  app.post('/', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const body = createDriverSchema.parse(request.body);
    const driver = await driverService.create(
      request.user.tenantId,
      body,
      request.tenant.max_drivers,
    );
    return reply.status(201).send({ success: true, data: driver });
  });

  app.put('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateDriverSchema.parse(request.body);
    const driver = await driverService.update(request.user.tenantId, id, body);
    return reply.send({ success: true, data: driver });
  });

  app.delete('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const driver = await driverService.softDelete(request.user.tenantId, id);
    return reply.send({ success: true, data: driver });
  });

  app.post(
    '/:id/assign-vehicle',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({ vehicle_id: z.string().uuid() }).parse(request.body);
      const result = await driverService.assignVehicle(
        request.user.tenantId,
        id,
        body.vehicle_id,
      );
      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    '/:id/unassign-vehicle',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await driverService.unassignVehicle(
        request.user.tenantId,
        id,
      );
      return reply.send({ success: true, data: result });
    },
  );

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
