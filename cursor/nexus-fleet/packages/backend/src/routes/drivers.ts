import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ilike, desc, asc, sql, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { drivers, vehicles } from '../db/schema.js';
import {
  createDriverSchema,
  updateDriverSchema,
  driverFilterSchema,
} from '@nexus-fleet/shared';
import { VEHICLE_LICENSE_REQUIREMENTS } from '@nexus-fleet/shared';

export default async function driverRoutes(fastify: FastifyInstance) {
  // GET / – list drivers
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const query = driverFilterSchema.parse(request.query);
    const { page, limit, sortBy, sortOrder, search } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(drivers.tenantId, tenantId), eq(drivers.isActive, true)];

    if (query.status) {
      conditions.push(eq(drivers.status, query.status));
    }
    if (search) {
      conditions.push(
        sql`(${drivers.name} ILIKE ${'%' + search + '%'} OR ${drivers.email} ILIKE ${'%' + search + '%'} OR ${drivers.employeeId} ILIKE ${'%' + search + '%'})`,
      );
    }

    const where = and(...conditions);
    const sortCol = sortBy === 'name' ? drivers.name : drivers.createdAt;
    const direction =
      sortBy?.startsWith('-') ? desc(sortCol) : sortOrder === 'asc' ? asc(sortCol) : desc(sortCol);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(drivers).where(where).orderBy(direction).limit(limit).offset(offset),
      db.select({ total: count() }).from(drivers).where(where),
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

  // POST / – create driver
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const body = createDriverSchema.parse(request.body);

    const [existing] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(and(eq(drivers.tenantId, tenantId), eq(drivers.licenseNumber, body.licenseNumber)));

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'DUPLICATE_LICENSE',
          message: 'A driver with this license number already exists',
        },
      });
    }

    const [driver] = await db
      .insert(drivers)
      .values({
        tenantId,
        employeeId: `EMP-${Date.now()}`,
        name: `${body.firstName} ${body.lastName}`,
        email: body.email,
        phone: body.phone,
        licenseNumber: body.licenseNumber,
        licenseClasses: [body.licenseClass],
        licenseExpiry: new Date(body.licenseExpiry),
        status: 'off_duty',
      })
      .returning();

    return reply.status(201).send({ success: true, data: driver });
  });

  // GET /:id – get driver by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [driver] = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)));

    if (!driver) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Driver not found' },
      });
    }

    return reply.send({ success: true, data: driver });
  });

  // PUT /:id – update driver
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;
    const body = updateDriverSchema.parse(request.body);

    const [existing] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Driver not found' },
      });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (body.firstName || body.lastName) {
      const parts: string[] = [];
      if (body.firstName) parts.push(body.firstName);
      if (body.lastName) parts.push(body.lastName);
      if (parts.length > 0) updateValues.name = parts.join(' ');
    }
    if (body.phone) updateValues.phone = body.phone;
    if (body.licenseNumber) updateValues.licenseNumber = body.licenseNumber;
    if (body.licenseClass) updateValues.licenseClasses = [body.licenseClass];
    if (body.licenseExpiry) updateValues.licenseExpiry = new Date(body.licenseExpiry);
    if (body.status) updateValues.status = body.status;

    const [updated] = await db
      .update(drivers)
      .set(updateValues)
      .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:id – soft delete
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [existing] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Driver not found' },
      });
    }

    const [updated] = await db
      .update(drivers)
      .set({ isActive: false, status: 'off_duty', updatedAt: new Date() })
      .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // POST /:id/assign-vehicle – assign driver to vehicle
  fastify.post(
    '/:id/assign-vehicle',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { vehicleId: string } }>,
      reply: FastifyReply,
    ) => {
      const { tenantId } = request.user!;
      const { id: driverId } = request.params;
      const { vehicleId } = request.body as { vehicleId: string };

      if (!vehicleId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'vehicleId is required' },
        });
      }

      const [driver] = await db
        .select()
        .from(drivers)
        .where(and(eq(drivers.id, driverId), eq(drivers.tenantId, tenantId)));

      if (!driver) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      const [vehicle] = await db
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.id, vehicleId), eq(vehicles.tenantId, tenantId)));

      if (!vehicle) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vehicle not found' },
        });
      }

      // Validate driver is available
      if (driver.status !== 'available' && driver.status !== 'off_duty') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DRIVER_UNAVAILABLE',
            message: `Driver is currently "${driver.status}" and cannot be assigned`,
          },
        });
      }

      // Validate vehicle is available
      if (vehicle.status !== 'available') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'VEHICLE_UNAVAILABLE',
            message: `Vehicle is currently "${vehicle.status}" and cannot be assigned`,
          },
        });
      }

      // Check vehicle doesn't already have a driver
      if (vehicle.currentDriverId) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'VEHICLE_ALREADY_ASSIGNED',
            message: 'Vehicle already has an assigned driver',
          },
        });
      }

      // Check driver isn't already assigned to another vehicle
      const [alreadyAssigned] = await db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
          and(eq(vehicles.tenantId, tenantId), eq(vehicles.currentDriverId, driverId)),
        );

      if (alreadyAssigned) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DRIVER_ALREADY_ASSIGNED',
            message: 'Driver is already assigned to another vehicle',
          },
        });
      }

      // Check license class compatibility
      const requiredClass = VEHICLE_LICENSE_REQUIREMENTS[vehicle.type];
      if (
        requiredClass &&
        driver.licenseClasses &&
        !driver.licenseClasses.includes(requiredClass)
      ) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'LICENSE_INCOMPATIBLE',
            message: `Vehicle type "${vehicle.type}" requires license class "${requiredClass}"`,
          },
        });
      }

      // Check license not expired
      if (driver.licenseExpiry && new Date(driver.licenseExpiry) < new Date()) {
        return reply.status(409).send({
          success: false,
          error: { code: 'LICENSE_EXPIRED', message: "Driver's license has expired" },
        });
      }

      await db
        .update(vehicles)
        .set({ currentDriverId: driverId, updatedAt: new Date() })
        .where(eq(vehicles.id, vehicleId));

      await db
        .update(drivers)
        .set({ status: 'available', updatedAt: new Date() })
        .where(eq(drivers.id, driverId));

      return reply.send({
        success: true,
        data: { driverId, vehicleId, assignedAt: new Date().toISOString() },
      });
    },
  );

  // POST /:id/unassign-vehicle – unassign driver from vehicle
  fastify.post(
    '/:id/unassign-vehicle',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenantId } = request.user!;
      const { id: driverId } = request.params;

      const [driver] = await db
        .select({ id: drivers.id })
        .from(drivers)
        .where(and(eq(drivers.id, driverId), eq(drivers.tenantId, tenantId)));

      if (!driver) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      const [assignedVehicle] = await db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
          and(eq(vehicles.tenantId, tenantId), eq(vehicles.currentDriverId, driverId)),
        );

      if (!assignedVehicle) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'NOT_ASSIGNED',
            message: 'Driver is not currently assigned to any vehicle',
          },
        });
      }

      await db
        .update(vehicles)
        .set({ currentDriverId: null, updatedAt: new Date() })
        .where(eq(vehicles.id, assignedVehicle.id));

      await db
        .update(drivers)
        .set({ status: 'off_duty', updatedAt: new Date() })
        .where(eq(drivers.id, driverId));

      return reply.send({
        success: true,
        data: { driverId, vehicleId: assignedVehicle.id, unassignedAt: new Date().toISOString() },
      });
    },
  );
}
