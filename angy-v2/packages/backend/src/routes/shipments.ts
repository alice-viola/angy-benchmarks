import { FastifyInstance } from 'fastify';
import {
  shipmentRequestSchema,
  shipmentUpdateRequestSchema,
  shipmentTransitionRequestSchema,
} from '@nexusfleet/shared';
import {
  listShipments,
  createShipment,
  getShipmentById,
  updateShipment,
  softDeleteShipment,
  transitionShipment,
  getShipmentEvents,
} from '../services/shipment.service.js';

export async function shipmentRoutes(app: FastifyInstance) {
  // GET /api/v1/shipments
  app.get('/', async (request) => {
    const query = request.query as Record<string, string>;
    const result = await listShipments({
      tenant_id: request.user.tenant_id,
      status: query.status ? query.status.split(',') : undefined,
      priority: query.priority ? query.priority.split(',') : undefined,
      search: query.search,
      sort: query.sort ?? '-created_at',
      page: query.page ? Number(query.page) : 1,
      page_size: query.page_size ? Math.min(Number(query.page_size), 100) : 25,
    });

    return { success: true, data: result.data, meta: result.meta };
  });

  // POST /api/v1/shipments
  app.post('/', async (request, reply) => {
    const parsed = shipmentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const shipment = await createShipment(
      request.user.tenant_id,
      request.user.id,
      parsed.data,
    );

    return reply.status(201).send({ success: true, data: shipment });
  });

  // GET /api/v1/shipments/:id
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const shipment = await getShipmentById(request.params.id, request.user.tenant_id);
    if (!shipment) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found', details: null },
      });
    }
    return { success: true, data: shipment };
  });

  // PUT /api/v1/shipments/:id
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = shipmentUpdateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const result = await updateShipment(request.params.id, request.user.tenant_id, parsed.data);

    if (result.error === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found', details: null },
      });
    }

    if (result.error === 'INVALID_STATE') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Can only edit draft shipments',
          details: null,
        },
      });
    }

    return { success: true, data: result.data };
  });

  // DELETE /api/v1/shipments/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await softDeleteShipment(request.params.id, request.user.tenant_id);

    if (result.error === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found', details: null },
      });
    }

    if (result.error === 'INVALID_STATE') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Can only delete draft shipments',
          details: null,
        },
      });
    }

    return { success: true, data: null };
  });

  // POST /api/v1/shipments/:id/transition
  app.post<{ Params: { id: string } }>('/:id/transition', async (request, reply) => {
    const parsed = shipmentTransitionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { action, data } = parsed.data;

    const result = await transitionShipment(
      request.params.id,
      request.user.tenant_id,
      request.user.id,
      action,
      data,
    );

    if (result.code === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found', details: null },
      });
    }

    if (result.code === 'TRANSITION_FAILED') {
      const guard = 'guard' in result ? result.guard : undefined;
      return reply.status(409).send({
        success: false,
        error: {
          code: 'TRANSITION_FAILED',
          message: result.error!,
          details: guard ? { guard } : null,
        },
      });
    }

    // Return the full shipment from the detail endpoint for complete response
    const shipment = await getShipmentById(request.params.id, request.user.tenant_id);

    return { success: true, data: shipment };
  });

  // GET /api/v1/shipments/:id/events
  app.get<{ Params: { id: string } }>('/:id/events', async (request, reply) => {
    const events = await getShipmentEvents(request.params.id, request.user.tenant_id);

    if (events === null) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found', details: null },
      });
    }

    return { success: true, data: events };
  });
}
