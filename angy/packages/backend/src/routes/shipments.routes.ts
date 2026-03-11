import type { FastifyInstance } from 'fastify';
import {
  createShipmentSchema,
  updateShipmentSchema,
  shipmentActionSchema,
  shipmentFilterSchema,
} from '@nexus-fleet/shared';
import * as shipmentService from '../services/shipment.service.js';
import * as stateMachine from '../services/shipment-state-machine.js';
import { ServiceError } from '../services/vehicle.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export default async function shipmentRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const query = shipmentFilterSchema.parse(request.query);
    const q = request.query as any;
    const result = await shipmentService.list({
      tenantId: request.user.tenantId,
      status: query.status,
      priority: q.priority,
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
    const shipment = await shipmentService.getById(request.user.tenantId, id);
    return reply.send({ success: true, data: shipment });
  });

  app.get('/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    const events = await shipmentService.getEvents(request.user.tenantId, id);
    return reply.send({ success: true, data: events });
  });

  app.post('/', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const body = createShipmentSchema.parse(request.body);
    const shipment = await shipmentService.create(
      request.user.tenantId,
      body,
      request.user.userId,
    );
    return reply.status(201).send({ success: true, data: shipment });
  });

  app.put('/:id', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateShipmentSchema.parse(request.body);
    const shipment = await shipmentService.update(request.user.tenantId, id, body);
    return reply.send({ success: true, data: shipment });
  });

  app.delete('/:id', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await shipmentService.softDelete(request.user.tenantId, id);
    return reply.send({ success: true, data: result });
  });

  app.post('/:id/transition', { preHandler: requireRole('owner', 'admin', 'dispatcher') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = shipmentActionSchema.parse(request.body);
    const shipment = await stateMachine.transition(
      id,
      body.action,
      body,
      {
        userId: request.user.userId,
        tenantId: request.user.tenantId,
      },
    );
    return reply.send({ success: true, data: shipment });
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
