import { FastifyInstance } from 'fastify';
import {
  driverRequestSchema,
  driverUpdateRequestSchema,
  assignVehicleRequestSchema,
} from '@nexusfleet/shared';
import {
  listDrivers,
  createDriver,
  getDriverById,
  updateDriver,
  softDeleteDriver,
  assignVehicle,
  unassignVehicle,
} from '../services/driver.service.js';

export async function driverRoutes(app: FastifyInstance) {
  // GET /api/v1/drivers
  app.get('/', async (request) => {
    const query = request.query as Record<string, string>;
    const result = await listDrivers({
      tenant_id: request.user.tenant_id,
      status: query.status ? query.status.split(',') : undefined,
      search: query.search,
      sort: query.sort ?? '-created_at',
      page: query.page ? Number(query.page) : 1,
      page_size: query.page_size ? Math.min(Number(query.page_size), 100) : 25,
    });

    return { success: true, data: result.data, meta: result.meta };
  });

  // POST /api/v1/drivers
  app.post('/', async (request, reply) => {
    const parsed = driverRequestSchema.safeParse(request.body);
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
      const driver = await createDriver(
        request.user.tenant_id,
        request.user.id,
        parsed.data,
      );
      return reply.status(201).send({ success: true, data: driver });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Duplicate employee ID within tenant',
            details: null,
          },
        });
      }
      throw err;
    }
  });

  // GET /api/v1/drivers/:id
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // Avoid matching /drivers/xxx/assign-vehicle etc.
    const id = request.params.id;
    const driver = await getDriverById(id, request.user.tenant_id);
    if (!driver) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Driver not found', details: null },
      });
    }
    return { success: true, data: driver };
  });

  // PUT /api/v1/drivers/:id
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = driverUpdateRequestSchema.safeParse(request.body);
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
      const driver = await updateDriver(request.params.id, request.user.tenant_id, parsed.data);
      if (!driver) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found', details: null },
        });
      }
      return { success: true, data: driver };
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Duplicate employee ID within tenant',
            details: null,
          },
        });
      }
      throw err;
    }
  });

  // DELETE /api/v1/drivers/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await softDeleteDriver(request.params.id, request.user.tenant_id);

    if (result.error === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Driver not found', details: null },
      });
    }

    if (result.error === 'DRIVING') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Cannot delete driver that is currently driving',
          details: null,
        },
      });
    }

    return { success: true, data: null };
  });

  // POST /api/v1/drivers/:id/assign-vehicle
  app.post<{ Params: { id: string } }>('/:id/assign-vehicle', async (request, reply) => {
    const parsed = assignVehicleRequestSchema.safeParse(request.body);
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

    const result = await assignVehicle(
      request.params.id,
      parsed.data.vehicle_id,
      request.user.tenant_id,
    );

    if (result.code === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: result.error!, details: null },
      });
    }

    if (result.code === 'ASSIGNMENT_FAILED') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ASSIGNMENT_FAILED',
          message: result.error!,
          details: { guard: result.error },
        },
      });
    }

    return { success: true, data: result.data };
  });

  // POST /api/v1/drivers/:id/unassign-vehicle
  app.post<{ Params: { id: string } }>('/:id/unassign-vehicle', async (request, reply) => {
    const result = await unassignVehicle(request.params.id, request.user.tenant_id);

    if (result.code === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: result.error!, details: null },
      });
    }

    if (result.code === 'CONFLICT') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'CONFLICT',
          message: result.error!,
          details: null,
        },
      });
    }

    return { success: true, data: result.data };
  });
}
