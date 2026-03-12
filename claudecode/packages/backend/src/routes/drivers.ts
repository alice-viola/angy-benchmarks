import type { FastifyPluginAsync } from 'fastify';
import { eq, and, count, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { drivers, vehicles } from '../db/schema.js';
import { authorize } from '../middleware/authorize.js';
import { driverCreateSchema, driverUpdateSchema, paginationSchema } from '@nexus-fleet/shared';
import { getRequiredLicenseClass } from '@nexus-fleet/shared';
import type { VehicleType } from '@nexus-fleet/shared';

export const driverRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET / - List drivers
  // -------------------------------------------------------------------------
  fastify.get('/', async (request, reply) => {
    const tenantId = request.tenantId;
    const query = request.query as Record<string, string>;

    const pagination = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
    });

    const conditions = [eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)];

    if (query.status) {
      conditions.push(eq(drivers.status, query.status));
    }

    const offset = (pagination.page - 1) * pagination.pageSize;

    const [items, [totalResult]] = await Promise.all([
      db
        .select()
        .from(drivers)
        .where(and(...conditions))
        .orderBy(desc(drivers.created_at))
        .limit(pagination.pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(drivers)
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
  // POST / - Create driver
  // -------------------------------------------------------------------------
  fastify.post(
    '/',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const parsed = driverCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      // Check unique employee_id
      const [existingEmp] = await db
        .select({ id: drivers.id })
        .from(drivers)
        .where(
          and(eq(drivers.tenant_id, tenantId), eq(drivers.employee_id, parsed.data.employee_id)),
        )
        .limit(1);

      if (existingEmp) {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Driver with this employee ID already exists' },
        });
      }

      const [driver] = await db
        .insert(drivers)
        .values({
          tenant_id: tenantId,
          employee_id: parsed.data.employee_id,
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          phone: parsed.data.phone,
          license_number: parsed.data.license_number,
          license_expiry: new Date(parsed.data.license_expiry),
          license_classes: parsed.data.license_classes,
          max_driving_hours_day: String(parsed.data.max_driving_hours_day),
          status: 'off_duty',
        })
        .returning();

      return reply.status(201).send({ success: true, data: driver });
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id
  // -------------------------------------------------------------------------
  fastify.get('/:id', async (request, reply) => {
    const tenantId = request.tenantId;
    const { id } = request.params as { id: string };

    const [driver] = await db
      .select()
      .from(drivers)
      .where(
        and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)),
      )
      .limit(1);

    if (!driver) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Driver not found' },
      });
    }

    return reply.send({ success: true, data: driver });
  });

  // -------------------------------------------------------------------------
  // PUT /:id - Update
  // -------------------------------------------------------------------------
  fastify.put(
    '/:id',
    { preHandler: [authorize('owner', 'admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const parsed = driverUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const [existing] = await db
        .select()
        .from(drivers)
        .where(
          and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      const updateData: Record<string, any> = { updated_at: new Date() };
      const data = parsed.data;

      if (data.employee_id !== undefined) updateData.employee_id = data.employee_id;
      if (data.first_name !== undefined) updateData.first_name = data.first_name;
      if (data.last_name !== undefined) updateData.last_name = data.last_name;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.license_number !== undefined) updateData.license_number = data.license_number;
      if (data.license_expiry !== undefined) updateData.license_expiry = new Date(data.license_expiry);
      if (data.license_classes !== undefined) updateData.license_classes = data.license_classes;
      if (data.max_driving_hours_day !== undefined) updateData.max_driving_hours_day = String(data.max_driving_hours_day);

      const [updated] = await db
        .update(drivers)
        .set(updateData)
        .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId)))
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
        .from(drivers)
        .where(
          and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      // Unassign from vehicle if assigned
      if (existing.current_vehicle_id) {
        await db
          .update(vehicles)
          .set({ current_driver_id: null, updated_at: new Date() })
          .where(
            and(eq(vehicles.id, existing.current_vehicle_id), eq(vehicles.tenant_id, tenantId)),
          );
      }

      await db
        .update(drivers)
        .set({
          is_active: false,
          current_vehicle_id: null,
          status: 'off_duty',
          updated_at: new Date(),
        })
        .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId)));

      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // POST /:id/assign-vehicle
  // -------------------------------------------------------------------------
  fastify.post(
    '/:id/assign-vehicle',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };
      const { vehicle_id } = request.body as { vehicle_id: string };

      if (!vehicle_id) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'vehicle_id is required' },
        });
      }

      // Fetch driver
      const [driver] = await db
        .select()
        .from(drivers)
        .where(
          and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)),
        )
        .limit(1);

      if (!driver) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      // Fetch vehicle
      const [vehicle] = await db
        .select()
        .from(vehicles)
        .where(
          and(
            eq(vehicles.id, vehicle_id),
            eq(vehicles.tenant_id, tenantId),
            eq(vehicles.is_active, true),
          ),
        )
        .limit(1);

      if (!vehicle) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vehicle not found' },
        });
      }

      // Check driver availability
      if (driver.current_vehicle_id) {
        return reply.status(422).send({
          success: false,
          error: { code: 'ALREADY_ASSIGNED', message: 'Driver is already assigned to a vehicle' },
        });
      }

      // Check vehicle availability (mutual exclusivity)
      if (vehicle.current_driver_id) {
        return reply.status(422).send({
          success: false,
          error: { code: 'ALREADY_ASSIGNED', message: 'Vehicle already has an assigned driver' },
        });
      }

      // Validate license class
      const requiredClass = getRequiredLicenseClass(vehicle.type as VehicleType);
      const driverClasses = (driver.license_classes as string[]) ?? [];
      if (!driverClasses.includes(requiredClass)) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'INSUFFICIENT_LICENSE',
            message: `Driver needs license class ${requiredClass} for ${vehicle.type} vehicles`,
          },
        });
      }

      // Check license expiry
      if (driver.license_expiry < new Date()) {
        return reply.status(422).send({
          success: false,
          error: { code: 'LICENSE_EXPIRED', message: 'Driver license has expired' },
        });
      }

      // Assign
      await db.transaction(async (tx) => {
        await tx
          .update(drivers)
          .set({ current_vehicle_id: vehicle_id, updated_at: new Date() })
          .where(eq(drivers.id, id));

        await tx
          .update(vehicles)
          .set({ current_driver_id: id, updated_at: new Date() })
          .where(eq(vehicles.id, vehicle_id));
      });

      return reply.send({
        success: true,
        data: { message: 'Driver assigned to vehicle successfully' },
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /:id/unassign-vehicle
  // -------------------------------------------------------------------------
  fastify.post(
    '/:id/unassign-vehicle',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [driver] = await db
        .select()
        .from(drivers)
        .where(
          and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)),
        )
        .limit(1);

      if (!driver) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      if (!driver.current_vehicle_id) {
        return reply.status(422).send({
          success: false,
          error: { code: 'NOT_ASSIGNED', message: 'Driver is not assigned to any vehicle' },
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(vehicles)
          .set({ current_driver_id: null, updated_at: new Date() })
          .where(
            and(eq(vehicles.id, driver.current_vehicle_id!), eq(vehicles.tenant_id, tenantId)),
          );

        await tx
          .update(drivers)
          .set({ current_vehicle_id: null, updated_at: new Date() })
          .where(eq(drivers.id, id));
      });

      return reply.send({
        success: true,
        data: { message: 'Driver unassigned from vehicle successfully' },
      });
    },
  );
};
