import type { FastifyPluginAsync } from 'fastify';
import { eq, and, count, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { geofences, geofenceEvents } from '../db/schema.js';
import { authorize } from '../middleware/authorize.js';
import { geofenceCreateSchema, paginationSchema } from '@nexus-fleet/shared';

export const geofenceRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET / - List geofences
  // -------------------------------------------------------------------------
  fastify.get('/', async (request, reply) => {
    const tenantId = request.tenantId;
    const query = request.query as Record<string, string>;

    const pagination = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
    });

    const conditions = [eq(geofences.tenant_id, tenantId)];
    const offset = (pagination.page - 1) * pagination.pageSize;

    const [items, [totalResult]] = await Promise.all([
      db
        .select()
        .from(geofences)
        .where(and(...conditions))
        .orderBy(desc(geofences.created_at))
        .limit(pagination.pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(geofences)
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
  // POST / - Create geofence
  // -------------------------------------------------------------------------
  fastify.post(
    '/',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const parsed = geofenceCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const [geofence] = await db
        .insert(geofences)
        .values({
          tenant_id: tenantId,
          name: parsed.data.name,
          center_lat: String(parsed.data.center_lat),
          center_lng: String(parsed.data.center_lng),
          radius_m: String(parsed.data.radius_m),
          color: parsed.data.color,
          trigger_on_enter: parsed.data.trigger_on_enter,
          trigger_on_exit: parsed.data.trigger_on_exit,
          is_active: true,
        })
        .returning();

      return reply.status(201).send({ success: true, data: geofence });
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id
  // -------------------------------------------------------------------------
  fastify.get('/:id', async (request, reply) => {
    const tenantId = request.tenantId;
    const { id } = request.params as { id: string };

    const [geofence] = await db
      .select()
      .from(geofences)
      .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)))
      .limit(1);

    if (!geofence) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Geofence not found' },
      });
    }

    return reply.send({ success: true, data: geofence });
  });

  // -------------------------------------------------------------------------
  // PUT /:id
  // -------------------------------------------------------------------------
  fastify.put(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(geofences)
        .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Geofence not found' },
        });
      }

      const body = request.body as Record<string, any>;
      const updateData: Record<string, any> = { updated_at: new Date() };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.center_lat !== undefined) updateData.center_lat = String(body.center_lat);
      if (body.center_lng !== undefined) updateData.center_lng = String(body.center_lng);
      if (body.radius_m !== undefined) updateData.radius_m = String(body.radius_m);
      if (body.color !== undefined) updateData.color = body.color;
      if (body.trigger_on_enter !== undefined) updateData.trigger_on_enter = body.trigger_on_enter;
      if (body.trigger_on_exit !== undefined) updateData.trigger_on_exit = body.trigger_on_exit;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const [updated] = await db
        .update(geofences)
        .set(updateData)
        .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)))
        .returning();

      return reply.send({ success: true, data: updated });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /:id
  // -------------------------------------------------------------------------
  fastify.delete(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(geofences)
        .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Geofence not found' },
        });
      }

      await db
        .delete(geofences)
        .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)));

      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id/events - List geofence trigger events
  // -------------------------------------------------------------------------
  fastify.get('/:id/events', async (request, reply) => {
    const tenantId = request.tenantId;
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;

    const pagination = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
    });

    // Verify geofence exists
    const [geofence] = await db
      .select({ id: geofences.id })
      .from(geofences)
      .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)))
      .limit(1);

    if (!geofence) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Geofence not found' },
      });
    }

    const offset = (pagination.page - 1) * pagination.pageSize;

    const [events, [totalResult]] = await Promise.all([
      db
        .select()
        .from(geofenceEvents)
        .where(
          and(eq(geofenceEvents.geofence_id, id), eq(geofenceEvents.tenant_id, tenantId)),
        )
        .orderBy(desc(geofenceEvents.created_at))
        .limit(pagination.pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(geofenceEvents)
        .where(
          and(eq(geofenceEvents.geofence_id, id), eq(geofenceEvents.tenant_id, tenantId)),
        ),
    ]);

    return reply.send({
      success: true,
      data: events,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / pagination.pageSize),
      },
    });
  });
};
