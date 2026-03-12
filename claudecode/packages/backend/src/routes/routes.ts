import type { FastifyPluginAsync } from 'fastify';
import { eq, and, count, desc, asc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { routes, routeStops, shipments } from '../db/schema.js';
import { authorize } from '../middleware/authorize.js';
import { routeCreateSchema, routeStopSchema, paginationSchema } from '@nexus-fleet/shared';
import { routeOptimizationQueue } from '../jobs/index.js';

export const routeRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET / - List routes
  // -------------------------------------------------------------------------
  fastify.get('/', async (request, reply) => {
    const tenantId = request.tenantId;
    const query = request.query as Record<string, string>;

    const pagination = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
    });

    const conditions = [eq(routes.tenant_id, tenantId)];

    if (query.status) {
      conditions.push(eq(routes.status, query.status));
    }

    const offset = (pagination.page - 1) * pagination.pageSize;

    const [items, [totalResult]] = await Promise.all([
      db
        .select()
        .from(routes)
        .where(and(...conditions))
        .orderBy(desc(routes.created_at))
        .limit(pagination.pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(routes)
        .where(and(...conditions)),
    ]);

    return reply.send({
      success: true,
      data: items,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / pagination.pageSize),
      },
    });
  });

  // -------------------------------------------------------------------------
  // POST / - Create route
  // -------------------------------------------------------------------------
  fastify.post(
    '/',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const parsed = routeCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const result = await db.transaction(async (tx) => {
        const [route] = await tx
          .insert(routes)
          .values({
            tenant_id: tenantId,
            name: parsed.data.name,
            vehicle_id: parsed.data.vehicle_id ?? null,
            driver_id: parsed.data.driver_id ?? null,
            planned_date: new Date(parsed.data.planned_date),
            status: 'draft',
          })
          .returning();

        // Insert stops if provided
        if (parsed.data.stops && parsed.data.stops.length > 0) {
          await tx.insert(routeStops).values(
            parsed.data.stops.map((stop) => ({
              tenant_id: tenantId,
              route_id: route.id,
              shipment_id: stop.shipment_id ?? null,
              stop_type: stop.stop_type,
              sequence_order: stop.sequence_order,
              location_lat: String(stop.location_lat),
              location_lng: String(stop.location_lng),
              address: stop.address,
              status: 'pending',
            })),
          );
        }

        return route;
      });

      return reply.status(201).send({ success: true, data: result });
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id - Get route with stops
  // -------------------------------------------------------------------------
  fastify.get('/:id', async (request, reply) => {
    const tenantId = request.tenantId;
    const { id } = request.params as { id: string };

    const [route] = await db
      .select()
      .from(routes)
      .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)))
      .limit(1);

    if (!route) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    }

    const stops = await db
      .select()
      .from(routeStops)
      .where(and(eq(routeStops.route_id, id), eq(routeStops.tenant_id, tenantId)))
      .orderBy(asc(routeStops.sequence_order));

    return reply.send({
      success: true,
      data: { ...route, stops },
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:id - Update route
  // -------------------------------------------------------------------------
  fastify.put(
    '/:id',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(routes)
        .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route not found' },
        });
      }

      const body = request.body as Record<string, any>;
      const updateData: Record<string, any> = { updated_at: new Date() };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.vehicle_id !== undefined) updateData.vehicle_id = body.vehicle_id;
      if (body.driver_id !== undefined) updateData.driver_id = body.driver_id;
      if (body.planned_date !== undefined) updateData.planned_date = new Date(body.planned_date);
      if (body.status !== undefined) updateData.status = body.status;

      const [updated] = await db
        .update(routes)
        .set(updateData)
        .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)))
        .returning();

      return reply.send({ success: true, data: updated });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /:id - Delete (draft only)
  // -------------------------------------------------------------------------
  fastify.delete(
    '/:id',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(routes)
        .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route not found' },
        });
      }

      if (existing.status !== 'draft') {
        return reply.status(422).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Only draft routes can be deleted' },
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .delete(routeStops)
          .where(and(eq(routeStops.route_id, id), eq(routeStops.tenant_id, tenantId)));
        await tx
          .delete(routes)
          .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)));
      });

      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // POST /:id/optimize - Trigger optimization job (returns 202 + jobId)
  // -------------------------------------------------------------------------
  fastify.post(
    '/:id/optimize',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [route] = await db
        .select()
        .from(routes)
        .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)))
        .limit(1);

      if (!route) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route not found' },
        });
      }

      const job = await routeOptimizationQueue.add('optimize-route', {
        routeId: id,
        tenantId,
      });

      return reply.status(202).send({
        success: true,
        data: { jobId: job.id, status: 'queued' },
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id/optimize/:jobId - Poll job status
  // -------------------------------------------------------------------------
  fastify.get('/:id/optimize/:jobId', async (request, reply) => {
    const { jobId } = request.params as { id: string; jobId: string };

    const job = await routeOptimizationQueue.getJob(jobId);
    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job not found' },
      });
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;

    return reply.send({
      success: true,
      data: {
        jobId: job.id,
        status: state,
        progress,
        result: state === 'completed' ? result : undefined,
      },
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:id/stops - Bulk update stop order
  // -------------------------------------------------------------------------
  fastify.put(
    '/:id/stops',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };
      const { stops } = request.body as { stops: Array<{ id: string; sequence_order: number }> };

      if (!stops || !Array.isArray(stops)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'stops array is required' },
        });
      }

      const [route] = await db
        .select()
        .from(routes)
        .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)))
        .limit(1);

      if (!route) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route not found' },
        });
      }

      await db.transaction(async (tx) => {
        for (const stop of stops) {
          await tx
            .update(routeStops)
            .set({ sequence_order: stop.sequence_order, updated_at: new Date() })
            .where(
              and(
                eq(routeStops.id, stop.id),
                eq(routeStops.route_id, id),
                eq(routeStops.tenant_id, tenantId),
              ),
            );
        }
      });

      // Fetch updated stops
      const updatedStops = await db
        .select()
        .from(routeStops)
        .where(and(eq(routeStops.route_id, id), eq(routeStops.tenant_id, tenantId)))
        .orderBy(asc(routeStops.sequence_order));

      return reply.send({ success: true, data: updatedStops });
    },
  );

  // -------------------------------------------------------------------------
  // POST /:id/stops/:stopId/complete - Mark stop completed
  // -------------------------------------------------------------------------
  fastify.post(
    '/:id/stops/:stopId/complete',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id, stopId } = request.params as { id: string; stopId: string };

      const [stop] = await db
        .select()
        .from(routeStops)
        .where(
          and(
            eq(routeStops.id, stopId),
            eq(routeStops.route_id, id),
            eq(routeStops.tenant_id, tenantId),
          ),
        )
        .limit(1);

      if (!stop) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route stop not found' },
        });
      }

      if (stop.status === 'completed') {
        return reply.status(422).send({
          success: false,
          error: { code: 'ALREADY_COMPLETED', message: 'Stop is already completed' },
        });
      }

      await db
        .update(routeStops)
        .set({
          status: 'completed',
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(routeStops.id, stopId));

      // If delivery stop with linked shipment, transition shipment to delivered
      if (stop.stop_type === 'delivery' && stop.shipment_id) {
        const { ShipmentStateMachine } = await import('../services/shipment-state-machine.js');
        try {
          await ShipmentStateMachine.transition(
            stop.shipment_id,
            'deliver',
            { route_stop_id: stopId },
            { tenantId, userId: request.user.userId },
          );
        } catch (err) {
          request.log.warn(
            { err, shipmentId: stop.shipment_id },
            'Failed to auto-transition shipment to delivered on stop completion',
          );
        }
      }

      // Check if all stops are completed; if so, mark route as completed
      const pendingStops = await db
        .select({ count: count() })
        .from(routeStops)
        .where(
          and(
            eq(routeStops.route_id, id),
            eq(routeStops.tenant_id, tenantId),
            eq(routeStops.status, 'pending'),
          ),
        );

      if ((pendingStops[0]?.count ?? 0) === 0) {
        await db
          .update(routes)
          .set({ status: 'completed', completed_at: new Date(), updated_at: new Date() })
          .where(and(eq(routes.id, id), eq(routes.tenant_id, tenantId)));
      }

      return reply.send({
        success: true,
        data: { message: 'Stop completed successfully' },
      });
    },
  );
};
