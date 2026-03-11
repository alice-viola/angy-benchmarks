import type { FastifyInstance } from 'fastify';
import { createGeofenceSchema, updateGeofenceSchema, geofenceFilterSchema } from '@nexus-fleet/shared';
import * as geofenceService from '../services/geofence.service.js';
import { ServiceError } from '../services/vehicle.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export default async function geofenceRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const query = geofenceFilterSchema.parse(request.query);
    const result = await geofenceService.list({
      tenantId: request.user.tenantId,
      page: query.page,
      limit: query.limit,
    });

    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const geofence = await geofenceService.getById(request.user.tenantId, id);
    return reply.send({ success: true, data: geofence });
  });

  app.get('/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as any;
    const page = parseInt(q.page) || 1;
    const limit = parseInt(q.limit) || 20;
    const result = await geofenceService.getEvents(request.user.tenantId, id, page, limit);
    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  app.post('/', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const body = createGeofenceSchema.parse(request.body);
    const geofence = await geofenceService.create(request.user.tenantId, body);
    return reply.status(201).send({ success: true, data: geofence });
  });

  app.put('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateGeofenceSchema.parse(request.body);
    const geofence = await geofenceService.update(request.user.tenantId, id, body);
    return reply.send({ success: true, data: geofence });
  });

  app.delete('/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await geofenceService.softDelete(request.user.tenantId, id);
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
