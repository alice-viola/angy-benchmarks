import { FastifyInstance } from 'fastify';
import { vehicleRequestSchema, vehicleUpdateRequestSchema } from '@nexusfleet/shared';
import {
  listVehicles,
  createVehicle,
  getVehicleById,
  updateVehicle,
  softDeleteVehicle,
} from '../services/vehicle.service.js';

export async function vehicleRoutes(app: FastifyInstance) {
  // GET /api/v1/vehicles
  app.get('/', async (request) => {
    const query = request.query as Record<string, string>;
    const result = await listVehicles({
      tenant_id: request.user.tenant_id,
      status: query.status ? query.status.split(',') : undefined,
      type: query.type ? query.type.split(',') : undefined,
      search: query.search,
      sort: query.sort ?? '-created_at',
      page: query.page ? Number(query.page) : 1,
      page_size: query.page_size ? Math.min(Number(query.page_size), 100) : 25,
    });

    return { success: true, data: result.data, meta: result.meta };
  });

  // POST /api/v1/vehicles
  app.post('/', async (request, reply) => {
    const parsed = vehicleRequestSchema.safeParse(request.body);
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

    try {
      const vehicle = await createVehicle(
        request.user.tenant_id,
        request.user.id,
        parsed.data,
      );
      return reply.status(201).send({ success: true, data: vehicle });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Duplicate registration or VIN within tenant',
            details: null,
          },
        });
      }
      throw err;
    }
  });

  // GET /api/v1/vehicles/:id
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const vehicle = await getVehicleById(request.params.id, request.user.tenant_id);
    if (!vehicle) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vehicle not found', details: null },
      });
    }
    return { success: true, data: vehicle };
  });

  // PUT /api/v1/vehicles/:id
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = vehicleUpdateRequestSchema.safeParse(request.body);
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

    try {
      const vehicle = await updateVehicle(request.params.id, request.user.tenant_id, parsed.data);
      if (!vehicle) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vehicle not found', details: null },
        });
      }
      return { success: true, data: vehicle };
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Duplicate registration or VIN within tenant',
            details: null,
          },
        });
      }
      throw err;
    }
  });

  // DELETE /api/v1/vehicles/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await softDeleteVehicle(request.params.id, request.user.tenant_id);

    if (result.error === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vehicle not found', details: null },
      });
    }

    if (result.error === 'IN_TRANSIT') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Cannot delete vehicle that is currently in transit',
          details: null,
        },
      });
    }

    return { success: true, data: null };
  });
}
