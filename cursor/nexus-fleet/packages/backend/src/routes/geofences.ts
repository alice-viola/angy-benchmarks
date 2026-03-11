import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { geofences, geofenceEvents } from '../db/schema.js';
import {
  createGeofenceSchema,
  updateGeofenceSchema,
  paginationSchema,
} from '@nexus-fleet/shared';

export default async function geofenceRoutes(fastify: FastifyInstance) {
  // GET / – list geofences
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { page, limit } = paginationSchema.parse(request.query);
    const offset = (page - 1) * limit;

    const where = eq(geofences.tenantId, tenantId);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(geofences)
        .where(where)
        .orderBy(desc(geofences.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(geofences).where(where),
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

  // POST / – create geofence
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const body = createGeofenceSchema.parse(request.body);

    const centerPoint = sql`ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)`;
    // ST_Buffer with geography cast produces a meter-based buffer, cast back to geometry
    const buffered = sql`ST_Buffer(${centerPoint}::geography, ${body.radiusM})::geometry`;

    const [geofence] = await db
      .insert(geofences)
      .values({
        tenantId,
        name: body.name,
        description: body.description,
        center: centerPoint as any,
        radiusM: body.radiusM.toString(),
        geometry: buffered as any,
        isActive: body.isActive,
      })
      .returning();

    return reply.status(201).send({ success: true, data: geofence });
  });

  // GET /:id – get geofence by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const rows = await db.execute(sql`
      SELECT *,
        ST_X(center::geometry) AS lng,
        ST_Y(center::geometry) AS lat
      FROM geofences
      WHERE id = ${id} AND tenant_id = ${tenantId}
      LIMIT 1
    `);

    const geofence = rows.rows?.[0] ?? rows[0];
    if (!geofence) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Geofence not found' },
      });
    }

    return reply.send({ success: true, data: geofence });
  });

  // PUT /:id – update geofence
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;
    const body = updateGeofenceSchema.parse(request.body);

    const [existing] = await db
      .select({ id: geofences.id })
      .from(geofences)
      .where(and(eq(geofences.id, id), eq(geofences.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Geofence not found' },
      });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name) updateValues.name = body.name;
    if (body.description !== undefined) updateValues.description = body.description;
    if (body.isActive !== undefined) updateValues.isActive = body.isActive;
    if (body.radiusM) updateValues.radiusM = body.radiusM.toString();

    // If lat/lng or radius changed, recalculate geometry
    if (body.lat != null && body.lng != null) {
      const centerPoint = sql`ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)`;
      updateValues.center = centerPoint;
      const radius = body.radiusM ?? 0;
      if (radius > 0) {
        updateValues.geometry = sql`ST_Buffer(${centerPoint}::geography, ${radius})::geometry`;
      }
    } else if (body.radiusM) {
      // Radius changed but center didn't – use existing center
      updateValues.geometry = sql`ST_Buffer(center::geography, ${body.radiusM})::geometry`;
    }

    const [updated] = await db
      .update(geofences)
      .set(updateValues)
      .where(and(eq(geofences.id, id), eq(geofences.tenantId, tenantId)))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:id – delete geofence
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [existing] = await db
      .select({ id: geofences.id })
      .from(geofences)
      .where(and(eq(geofences.id, id), eq(geofences.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Geofence not found' },
      });
    }

    await db.delete(geofenceEvents).where(eq(geofenceEvents.geofenceId, id));
    await db.delete(geofences).where(eq(geofences.id, id));

    return reply.send({ success: true, data: { id } });
  });

  // GET /:id/events – list geofence events
  fastify.get(
    '/:id/events',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenantId } = request.user!;
      const { id } = request.params;
      const { page, limit } = paginationSchema.parse(request.query);
      const offset = (page - 1) * limit;

      const [geofence] = await db
        .select({ id: geofences.id })
        .from(geofences)
        .where(and(eq(geofences.id, id), eq(geofences.tenantId, tenantId)));

      if (!geofence) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Geofence not found' },
        });
      }

      const where = eq(geofenceEvents.geofenceId, id);

      const [events, [{ total }]] = await Promise.all([
        db
          .select()
          .from(geofenceEvents)
          .where(where)
          .orderBy(desc(geofenceEvents.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(geofenceEvents).where(where),
      ]);

      return reply.send({
        success: true,
        data: events,
        pagination: {
          page,
          limit,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / limit),
        },
      });
    },
  );
}
