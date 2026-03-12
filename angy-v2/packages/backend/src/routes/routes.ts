import { FastifyInstance } from 'fastify';
import {
  routeRequestSchema,
  routeUpdateRequestSchema,
  bulkStopReorderRequestSchema,
  stopCompleteRequestSchema,
} from '@nexusfleet/shared';
import {
  listRoutes,
  createRoute,
  getRouteById,
  updateRoute,
  softDeleteRoute,
  bulkReorderStops,
  completeStop,
} from '../services/route.service.js';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

let optimizationQueue: Queue | null = null;

function getOptimizationQueue(): Queue {
  if (!optimizationQueue) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    optimizationQueue = new Queue('route-optimization', { connection: connection as any });
  }
  return optimizationQueue;
}

export async function routeRoutes(app: FastifyInstance) {
  // GET /api/v1/routes
  app.get('/', async (request) => {
    const query = request.query as Record<string, string>;
    const result = await listRoutes({
      tenant_id: request.user.tenant_id,
      status: query.status ? query.status.split(',') : undefined,
      planned_date: query.planned_date,
      sort: query.sort ?? '-created_at',
      page: query.page ? Number(query.page) : 1,
      page_size: query.page_size ? Math.min(Number(query.page_size), 100) : 25,
    });

    return { success: true, data: result.data, meta: result.meta };
  });

  // POST /api/v1/routes
  app.post('/', async (request, reply) => {
    const parsed = routeRequestSchema.safeParse(request.body);
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

    const route = await createRoute(
      request.user.tenant_id,
      request.user.id,
      parsed.data,
    );

    return reply.status(201).send({ success: true, data: route });
  });

  // GET /api/v1/routes/:id
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const route = await getRouteById(request.params.id, request.user.tenant_id);
    if (!route) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found', details: null },
      });
    }
    return { success: true, data: route };
  });

  // PUT /api/v1/routes/:id
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = routeUpdateRequestSchema.safeParse(request.body);
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

    const route = await updateRoute(request.params.id, request.user.tenant_id, parsed.data);
    if (!route) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found', details: null },
      });
    }
    return { success: true, data: route };
  });

  // DELETE /api/v1/routes/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await softDeleteRoute(request.params.id, request.user.tenant_id);

    if (result.error === 'NOT_FOUND') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found', details: null },
      });
    }

    if (result.error === 'INVALID_STATE') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Can only delete draft routes',
          details: null,
        },
      });
    }

    return { success: true, data: null };
  });

  // POST /api/v1/routes/:id/optimize
  app.post<{ Params: { id: string } }>('/:id/optimize', async (request, reply) => {
    // Verify route exists
    const route = await getRouteById(request.params.id, request.user.tenant_id);
    if (!route) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found', details: null },
      });
    }

    // Enqueue BullMQ job
    const queue = getOptimizationQueue();
    const job = await queue.add('optimize', {
      route_id: request.params.id,
      tenant_id: request.user.tenant_id,
    });

    return reply.status(202).send({
      success: true,
      data: { job_id: job.id! },
    });
  });

  // GET /api/v1/routes/:id/optimize/:jobId
  app.get<{ Params: { id: string; jobId: string } }>(
    '/:id/optimize/:jobId',
    async (request, reply) => {
      const queue = getOptimizationQueue();
      const job = await queue.getJob(request.params.jobId);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Job not found', details: null },
        });
      }

      const state = await job.getState();
      const progress = typeof job.progress === 'number' ? job.progress : 0;

      let status: string;
      if (state === 'completed') status = 'completed';
      else if (state === 'active') status = 'active';
      else if (state === 'failed') status = 'failed';
      else status = 'pending';

      return {
        success: true,
        data: {
          status,
          progress,
          result: state === 'completed' ? job.returnvalue : null,
        },
      };
    },
  );

  // PUT /api/v1/routes/:id/stops
  app.put<{ Params: { id: string } }>('/:id/stops', async (request, reply) => {
    const parsed = bulkStopReorderRequestSchema.safeParse(request.body);
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

    const route = await bulkReorderStops(
      request.params.id,
      request.user.tenant_id,
      parsed.data.stops,
    );

    if (!route) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found', details: null },
      });
    }

    return { success: true, data: route };
  });

  // POST /api/v1/routes/:id/stops/:stopId/complete
  app.post<{ Params: { id: string; stopId: string } }>(
    '/:id/stops/:stopId/complete',
    async (request, reply) => {
      const parsed = stopCompleteRequestSchema.safeParse(request.body ?? {});
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

      const result = await completeStop(
        request.params.id,
        request.params.stopId,
        request.user.tenant_id,
        request.user.id,
        parsed.data,
      );

      if (result.error === 'NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route or stop not found', details: null },
        });
      }

      if (result.error === 'TRANSITION_FAILED') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'TRANSITION_FAILED',
            message: 'Proof of delivery required to complete delivery stop',
            details: { guard: (result as any).guard ?? 'At least pod_signature_url or one pod_photo_urls entry is required' },
          },
        });
      }

      return { success: true, data: result.data };
    },
  );
}
