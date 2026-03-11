import type { FastifyInstance } from 'fastify';
import * as analyticsService from '../services/analytics.service.js';
import { ServiceError } from '../services/vehicle.service.js';
import { z } from 'zod';

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get('/overview', async (request, reply) => {
    const result = await analyticsService.overview(request.user.tenantId);
    return reply.send({ success: true, data: result });
  });

  app.get('/shipments', async (request, reply) => {
    const query = z
      .object({
        from: z.string().min(1),
        to: z.string().min(1),
      })
      .parse(request.query);

    const result = await analyticsService.shipmentsByDateRange(
      request.user.tenantId,
      query.from,
      query.to,
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
