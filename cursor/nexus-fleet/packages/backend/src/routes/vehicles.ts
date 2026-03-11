import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ilike, desc, asc, sql, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles } from '../db/schema.js';
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleFilterSchema,
} from '@nexus-fleet/shared';

const SORT_COLUMNS: Record<string, typeof vehicles.createdAt> = {
  created_at: vehicles.createdAt,
  updated_at: vehicles.updatedAt,
  registration: vehicles.registration as any,
  status: vehicles.status as any,
  type: vehicles.type as any,
};

export default async function vehicleRoutes(fastify: FastifyInstance) {
  // GET / – list vehicles
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const query = vehicleFilterSchema.parse(request.query);
    const { page, limit, sortBy, sortOrder, search } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(vehicles.tenantId, tenantId), eq(vehicles.isActive, true)];

    if (query.status) {
      conditions.push(eq(vehicles.status, query.status));
    }
    if (query.type) {
      conditions.push(eq(vehicles.type, query.type));
    }
    if (search) {
      conditions.push(
        sql`(${vehicles.registration} ILIKE ${'%' + search + '%'} OR ${vehicles.make} ILIKE ${'%' + search + '%'} OR ${vehicles.model} ILIKE ${'%' + search + '%'} OR ${vehicles.vin} ILIKE ${'%' + search + '%'})`,
      );
    }

    const where = and(...conditions);
    const sortCol = (sortBy && SORT_COLUMNS[sortBy.replace(/^-/, '')]) || vehicles.createdAt;
    const direction =
      sortBy?.startsWith('-') ? desc(sortCol) : sortOrder === 'asc' ? asc(sortCol) : desc(sortCol);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(vehicles).where(where).orderBy(direction).limit(limit).offset(offset),
      db.select({ total: count() }).from(vehicles).where(where),
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

  // POST / – create vehicle
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const body = createVehicleSchema.parse(request.body);

    if (!body.vin || body.vin.length !== 17) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'VIN must be exactly 17 characters' },
      });
    }

    const [existingVin] = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.tenantId, tenantId), eq(vehicles.vin, body.vin)));

    if (existingVin) {
      return reply.status(409).send({
        success: false,
        error: { code: 'DUPLICATE_VIN', message: 'A vehicle with this VIN already exists' },
      });
    }

    const [vehicle] = await db
      .insert(vehicles)
      .values({
        tenantId,
        registration: body.licensePlate,
        vin: body.vin,
        type: body.type,
        make: body.make,
        model: body.model,
        year: body.year,
        status: 'available',
        fuelType: body.fuelType,
        capacityKg: body.capacityKg.toString(),
        capacityM3: body.capacityM3?.toString(),
      })
      .returning();

    return reply.status(201).send({ success: true, data: vehicle });
  });

  // GET /:id – get vehicle by ID with current location
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const rows = await db.execute(sql`
      SELECT *,
        ST_X(last_location::geometry) AS lng,
        ST_Y(last_location::geometry) AS lat
      FROM vehicles
      WHERE id = ${id} AND tenant_id = ${tenantId}
      LIMIT 1
    `);

    const vehicle = rows.rows?.[0] ?? rows[0];
    if (!vehicle) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vehicle not found' },
      });
    }

    return reply.send({ success: true, data: vehicle });
  });

  // PUT /:id – update vehicle
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;
    const body = updateVehicleSchema.parse(request.body);

    const [existing] = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vehicle not found' },
      });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (body.licensePlate) updateValues.registration = body.licensePlate;
    if (body.status) updateValues.status = body.status;
    if (body.fuelType) updateValues.fuelType = body.fuelType;
    if (body.capacityKg) updateValues.capacityKg = body.capacityKg.toString();
    if (body.capacityM3 !== undefined) updateValues.capacityM3 = body.capacityM3?.toString();

    const [updated] = await db
      .update(vehicles)
      .set(updateValues)
      .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:id – soft delete (decommission)
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [existing] = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vehicle not found' },
      });
    }

    const [updated] = await db
      .update(vehicles)
      .set({ status: 'decommissioned', isActive: false, updatedAt: new Date() })
      .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
      .returning();

    return reply.send({ success: true, data: updated });
  });
}
