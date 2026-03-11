import type { FastifyInstance } from 'fastify';
import { createVehicleSchema, updateVehicleSchema, vehicleFilterSchema } from '@nexus-fleet/shared';
import * as vehicleService from '../services/vehicle.service.js';
import { ServiceError } from '../services/vehicle.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export default async function vehicleRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const query = vehicleFilterSchema.parse(request.query);
    const q = request.query as any;
    const result = await vehicleService.list({
      tenantId: request.user.tenantId,
      status: q.status,
      type: q.vehicle_type,
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
    const vehicle = await vehicleService.getById(request.user.tenantId, id);
    return reply.send({ success: true, data: vehicle });
  });

  app.post('/', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const body = createVehicleSchema.parse(request.body);
    const vehicle = await vehicleService.create(
      request.user.tenantId,
      body,
      request.tenant.max_vehicles,
    );
    return reply.status(201).send({ success: true, data: vehicle });
  });

  app.put('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateVehicleSchema.parse(request.body);
    const vehicle = await vehicleService.update(request.user.tenantId, id, body);
    return reply.send({ success: true, data: vehicle });
  });

  app.delete('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const vehicle = await vehicleService.softDelete(request.user.tenantId, id);
    return reply.send({ success: true, data: vehicle });
  });

  // Error handler
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
