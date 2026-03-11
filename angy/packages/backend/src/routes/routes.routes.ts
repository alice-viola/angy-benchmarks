import type { FastifyInstance } from 'fastify';
import { createRouteSchema, updateRouteSchema, routeFilterSchema } from '@nexus-fleet/shared';
import * as routeService from '../services/route.service.js';
import { ServiceError } from '../services/vehicle.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { z } from 'zod';

export default async function routeRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const query = routeFilterSchema.parse(request.query);
    const q = request.query as any;
    const result = await routeService.list({
      tenantId: request.user.tenantId,
      status: q.status,
      page: query.page,
      limit: query.limit,
    });

    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const route = await routeService.getById(request.user.tenantId, id);
    return reply.send({ success: true, data: route });
  });

  app.post('/', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const body = createRouteSchema.parse(request.body);
    const route = await routeService.create(request.user.tenantId, body);
    return reply.status(201).send({ success: true, data: route });
  });

  app.put('/:id', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRouteSchema.parse(request.body);
    const route = await routeService.update(request.user.tenantId, id, body);
    return reply.send({ success: true, data: route });
  });

  app.delete('/:id', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await routeService.softDelete(request.user.tenantId, id);
    return reply.send({ success: true, data: result });
  });

  app.put('/:id/stops', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      stops: z.array(z.object({
        id: z.string().uuid(),
        sequence_order: z.number().int().min(0),
      })),
    }).parse(request.body);
    const route = await routeService.updateStops(request.user.tenantId, id, body.stops);
    return reply.send({ success: true, data: route });
  });

  app.post('/:id/stops/:stopId/complete', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const { id, stopId } = request.params as { id: string; stopId: string };
    const body = z.object({
      pod_signature_url: z.string().optional(),
      pod_photo_urls: z.array(z.string()).optional(),
      pod_notes: z.string().optional(),
    }).parse(request.body);
    const stop = await routeService.completeStop(
      request.user.tenantId,
      id,
      stopId,
      body,
      { userId: request.user.userId, tenantId: request.user.tenantId },
    );
    return reply.send({ success: true, data: stop });
  });

  app.post('/:id/optimize', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await routeService.optimize(request.user.tenantId, id);
    return reply.status(202).send({ success: true, data: result });
  });

  app.get('/:id/optimize/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const result = await routeService.getOptimizationJob(jobId);
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
