import type { FastifyPluginAsync } from 'fastify';
import { eq, and, count, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles } from '../db/schema.js';
import { authorize } from '../middleware/authorize.js';
import { redis } from '../db/connection.js';
import { vehicleCreateSchema, vehicleUpdateSchema, paginationSchema } from '@nexus-fleet/shared';

export const vehicleRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET / - List vehicles with pagination
  // -------------------------------------------------------------------------
  fastify.get('/', async (request, reply) => {
    const tenantId = request.tenantId;
    const query = request.query as Record<string, string>;

    const pagination = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
    });

    const conditions = [eq(vehicles.tenant_id, tenantId), eq(vehicles.is_active, true)];

    if (query.status) {
      conditions.push(eq(vehicles.status, query.status));
    }

    if (query.type) {
      conditions.push(eq(vehicles.type, query.type));
    }

    const offset = (pagination.page - 1) * pagination.pageSize;

    const [items, [totalResult]] = await Promise.all([
      db
        .select()
        .from(vehicles)
        .where(and(...conditions))
        .orderBy(desc(vehicles.created_at))
        .limit(pagination.pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(vehicles)
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
  // POST / - Create vehicle
  // -------------------------------------------------------------------------
  fastify.post(
    '/',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const parsed = vehicleCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      // Check unique registration within tenant
      const [existingReg] = await db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
          and(eq(vehicles.tenant_id, tenantId), eq(vehicles.registration, parsed.data.registration)),
        )
        .limit(1);

      if (existingReg) {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Vehicle with this registration already exists' },
        });
      }

      const [vehicle] = await db
        .insert(vehicles)
        .values({
          tenant_id: tenantId,
          registration: parsed.data.registration,
          vin: parsed.data.vin,
          make: parsed.data.make,
          model: parsed.data.model,
          year: parsed.data.year,
          type: parsed.data.type,
          capacity_kg: String(parsed.data.capacity_kg),
          capacity_m3: String(parsed.data.capacity_m3),
          status: 'available',
        })
        .returning();

      return reply.status(201).send({ success: true, data: vehicle });
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id - Get by ID with current location from Redis
  // -------------------------------------------------------------------------
  fastify.get('/:id', async (request, reply) => {
    const tenantId = request.tenantId;
    const { id } = request.params as { id: string };

    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(
        and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenantId), eq(vehicles.is_active, true)),
      )
      .limit(1);

    if (!vehicle) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vehicle not found' },
      });
    }

    // Try to get real-time location from Redis
    let realtimeLocation = null;
    try {
      const locationData = await redis.hgetall(`vehicle_location:${id}`);
      if (locationData && locationData.lat) {
        realtimeLocation = {
          lat: parseFloat(locationData.lat),
          lng: parseFloat(locationData.lng),
          speed_kmh: parseFloat(locationData.speed_kmh ?? '0'),
          heading: parseFloat(locationData.heading ?? '0'),
          timestamp: locationData.timestamp,
        };
      }
    } catch {
      // Redis unavailable; fall back to DB location
    }

    return reply.send({
      success: true,
      data: {
        ...vehicle,
        realtime_location: realtimeLocation,
      },
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:id - Update vehicle
  // -------------------------------------------------------------------------
  fastify.put(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const parsed = vehicleUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const [existing] = await db
        .select()
        .from(vehicles)
        .where(
          and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenantId), eq(vehicles.is_active, true)),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vehicle not found' },
        });
      }

      const updateData: Record<string, any> = { updated_at: new Date() };
      const data = parsed.data;

      if (data.registration !== undefined) updateData.registration = data.registration;
      if (data.vin !== undefined) updateData.vin = data.vin;
      if (data.make !== undefined) updateData.make = data.make;
      if (data.model !== undefined) updateData.model = data.model;
      if (data.year !== undefined) updateData.year = data.year;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.capacity_kg !== undefined) updateData.capacity_kg = String(data.capacity_kg);
      if (data.capacity_m3 !== undefined) updateData.capacity_m3 = String(data.capacity_m3);

      const [updated] = await db
        .update(vehicles)
        .set(updateData)
        .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenantId)))
        .returning();

      return reply.send({ success: true, data: updated });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /:id - Soft delete
  // -------------------------------------------------------------------------
  fastify.delete(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(vehicles)
        .where(
          and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenantId), eq(vehicles.is_active, true)),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vehicle not found' },
        });
      }

      await db
        .update(vehicles)
        .set({
          is_active: false,
          status: 'decommissioned',
          updated_at: new Date(),
        })
        .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenantId)));

      return reply.status(204).send();
    },
  );
};
