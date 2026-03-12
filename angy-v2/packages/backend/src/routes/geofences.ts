import { FastifyInstance } from 'fastify';
import { geofenceRequestSchema, geofenceUpdateRequestSchema } from '@nexusfleet/shared';
import {
  listGeofences,
  createGeofence,
  getGeofenceById,
  updateGeofence,
  softDeleteGeofence,
} from '../services/geofence.service.js';

export async function geofenceRoutes(app: FastifyInstance) {
  // GET /api/v1/geofences
  app.get('/', async (request) => {
    const query = request.query as Record<string, string>;
    const result = await listGeofences({
      tenant_id: request.user.tenant_id,
      is_active: query.is_active !== undefined ? query.is_active === 'true' : undefined,
      sort: query.sort ?? '-created_at',
      page: query.page ? Number(query.page) : 1,
      page_size: query.page_size ? Math.min(Number(query.page_size), 100) : 25,
    });

    return { success: true, data: result.data, meta: result.meta };
  });

  // POST /api/v1/geofences
  app.post('/', async (request, reply) => {
    const parsed = geofenceRequestSchema.safeParse(request.body);
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

    const geofence = await createGeofence(
      request.user.tenant_id,
      request.user.id,
      parsed.data,
    );
    return reply.status(201).send({ success: true, data: geofence });
  });

  // GET /api/v1/geofences/:id
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const geofence = await getGeofenceById(request.params.id, request.user.tenant_id);
    if (!geofence) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Geofence not found', details: null },
      });
    }
    return { success: true, data: geofence };
  });

  // PUT /api/v1/geofences/:id
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = geofenceUpdateRequestSchema.safeParse(request.body);
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

    const geofence = await updateGeofence(request.params.id, request.user.tenant_id, parsed.data);
    if (!geofence) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Geofence not found', details: null },
      });
    }
    return { success: true, data: geofence };
  });

  // DELETE /api/v1/geofences/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await softDeleteGeofence(request.params.id, request.user.tenant_id);

    if (result.error === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Geofence not found', details: null },
      });
    }

    return { success: true, data: null };
  });
}
