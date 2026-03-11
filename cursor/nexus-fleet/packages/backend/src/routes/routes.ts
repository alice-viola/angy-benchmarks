import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, asc, sql, count } from 'drizzle-orm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../db/connection.js';
import { routes, routeStops, shipments } from '../db/schema.js';
import {
  createRouteSchema,
  updateRouteSchema,
  routeFilterSchema,
} from '@nexus-fleet/shared';
import { z } from 'zod';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
const optimizationQueue = new Queue('route-optimization', { connection: redis });

const bulkStopOrderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    sequence_order: z.number().int().min(0),
  }),
);

export default async function routeRoutes(fastify: FastifyInstance) {
  // GET / – list routes
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const query = routeFilterSchema.parse(request.query);
    const { page, limit, sortBy, sortOrder } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(routes.tenantId, tenantId)];

    if (query.status) {
      conditions.push(eq(routes.status, query.status));
    }
    if (query.vehicleId) {
      conditions.push(eq(routes.vehicleId, query.vehicleId));
    }
    if (query.driverId) {
      conditions.push(eq(routes.driverId, query.driverId));
    }
    if (query.from) {
      conditions.push(sql`${routes.scheduledStart}::date >= ${query.from}`);
    }
    if (query.to) {
      conditions.push(sql`${routes.scheduledStart}::date <= ${query.to}`);
    }

    const where = and(...conditions);
    const sortCol = sortBy === 'scheduled_start' ? routes.scheduledStart : routes.createdAt;
    const direction =
      sortBy?.startsWith('-') ? desc(sortCol) : sortOrder === 'asc' ? asc(sortCol) : desc(sortCol);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(routes).where(where).orderBy(direction).limit(limit).offset(offset),
      db.select({ total: count() }).from(routes).where(where),
    ]);

    return reply.send({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  });

  // POST / – create route
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const body = createRouteSchema.parse(request.body);

    const [route] = await db
      .insert(routes)
      .values({
        tenantId,
        name: body.name,
        status: 'draft',
        vehicleId: body.vehicleId,
        driverId: body.driverId,
        scheduledStart: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
      })
      .returning();

    if (body.stops?.length) {
      for (const stop of body.stops) {
        const addr = stop.address;
        const addrStr = [addr.street, addr.city, addr.state, addr.postalCode, addr.country].join(', ');

        await db.insert(routeStops).values({
          routeId: route.id,
          sequenceOrder: stop.sequence,
          type: stop.type,
          status: 'pending',
          address: addrStr,
          location:
            addr.lat != null && addr.lng != null
              ? (sql`ST_SetSRID(ST_MakePoint(${addr.lng}, ${addr.lat}), 4326)` as any)
              : undefined,
          shipmentId: stop.shipmentId,
          estimatedArrival: stop.scheduledArrival ? new Date(stop.scheduledArrival) : undefined,
          notes: stop.notes,
        });
      }
    }

    return reply.status(201).send({ success: true, data: route });
  });

  // GET /:id – get route with stops
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [route] = await db
      .select()
      .from(routes)
      .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)));

    if (!route) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    }

    const stops = await db
      .select()
      .from(routeStops)
      .where(eq(routeStops.routeId, id))
      .orderBy(asc(routeStops.sequenceOrder));

    return reply.send({ success: true, data: { ...route, stops } });
  });

  // PUT /:id – update route
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;
    const body = updateRouteSchema.parse(request.body);

    const [existing] = await db
      .select({ id: routes.id })
      .from(routes)
      .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name) updateValues.name = body.name;
    if (body.status) updateValues.status = body.status;
    if (body.vehicleId !== undefined) updateValues.vehicleId = body.vehicleId;
    if (body.driverId !== undefined) updateValues.driverId = body.driverId;
    if (body.scheduledDate) updateValues.scheduledStart = new Date(body.scheduledDate);

    const [updated] = await db
      .update(routes)
      .set(updateValues)
      .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:id – delete (draft only)
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [existing] = await db
      .select()
      .from(routes)
      .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    }

    if (existing.status !== 'draft') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Only draft routes can be deleted',
        },
      });
    }

    await db.delete(routeStops).where(eq(routeStops.routeId, id));
    await db.delete(routes).where(eq(routes.id, id));

    return reply.send({ success: true, data: { id } });
  });

  // POST /:id/optimize – trigger BullMQ optimization job
  fastify.post(
    '/:id/optimize',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenantId } = request.user!;
      const { id } = request.params;

      const [route] = await db
        .select()
        .from(routes)
        .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)));

      if (!route) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route not found' },
        });
      }

      const job = await optimizationQueue.add('optimize-route', {
        routeId: id,
        tenantId,
      });

      return reply.status(202).send({
        success: true,
        data: { jobId: job.id, routeId: id, status: 'queued' },
      });
    },
  );

  // GET /:id/optimize/:jobId – poll optimization job status
  fastify.get(
    '/:id/optimize/:jobId',
    async (
      request: FastifyRequest<{ Params: { id: string; jobId: string } }>,
      reply: FastifyReply,
    ) => {
      const { jobId } = request.params;

      const job = await optimizationQueue.getJob(jobId);
      if (!job) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Job not found' },
        });
      }

      const state = await job.getState();
      const progress = job.progress;

      return reply.send({
        success: true,
        data: {
          jobId: job.id,
          state,
          progress,
          result: state === 'completed' ? job.returnvalue : undefined,
          failedReason: state === 'failed' ? job.failedReason : undefined,
        },
      });
    },
  );

  // PUT /:id/stops – bulk update stop order
  fastify.put(
    '/:id/stops',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenantId } = request.user!;
      const { id } = request.params;
      const stopUpdates = bulkStopOrderSchema.parse(request.body);

      const [route] = await db
        .select({ id: routes.id })
        .from(routes)
        .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)));

      if (!route) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route not found' },
        });
      }

      for (const { id: stopId, sequence_order } of stopUpdates) {
        await db
          .update(routeStops)
          .set({ sequenceOrder: sequence_order, updatedAt: new Date() })
          .where(and(eq(routeStops.id, stopId), eq(routeStops.routeId, id)));
      }

      const stops = await db
        .select()
        .from(routeStops)
        .where(eq(routeStops.routeId, id))
        .orderBy(asc(routeStops.sequenceOrder));

      return reply.send({ success: true, data: stops });
    },
  );

  // POST /:id/stops/:stopId/complete – mark stop completed
  fastify.post(
    '/:id/stops/:stopId/complete',
    async (
      request: FastifyRequest<{ Params: { id: string; stopId: string } }>,
      reply: FastifyReply,
    ) => {
      const { tenantId, userId } = request.user!;
      const { id: routeId, stopId } = request.params;

      const [route] = await db
        .select({ id: routes.id })
        .from(routes)
        .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)));

      if (!route) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route not found' },
        });
      }

      const [stop] = await db
        .select()
        .from(routeStops)
        .where(and(eq(routeStops.id, stopId), eq(routeStops.routeId, routeId)));

      if (!stop) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Stop not found' },
        });
      }

      if (stop.status === 'completed') {
        return reply.status(409).send({
          success: false,
          error: { code: 'ALREADY_COMPLETED', message: 'Stop is already completed' },
        });
      }

      const [updatedStop] = await db
        .update(routeStops)
        .set({
          status: 'completed',
          actualArrival: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(routeStops.id, stopId))
        .returning();

      // If this is a delivery stop with a linked shipment, transition it to delivered
      if (stop.type === 'delivery' && stop.shipmentId) {
        const [shipment] = await db
          .select()
          .from(shipments)
          .where(
            and(eq(shipments.id, stop.shipmentId), eq(shipments.tenantId, tenantId)),
          );

        if (shipment && shipment.status === 'in_transit') {
          await db
            .update(shipments)
            .set({
              status: 'delivered',
              actualDelivery: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(shipments.id, stop.shipmentId));

          const { shipmentEvents } = await import('../db/schema.js');
          await db.insert(shipmentEvents).values({
            shipmentId: stop.shipmentId,
            status: 'delivered',
            previousStatus: shipment.status,
            actorId: userId,
            notes: `Auto-delivered via route stop completion`,
          });
        }
      }

      return reply.send({ success: true, data: updatedStop });
    },
  );
}
