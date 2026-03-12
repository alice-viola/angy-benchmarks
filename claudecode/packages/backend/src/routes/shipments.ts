import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, asc, ilike, or, sql, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { shipments, shipmentEvents } from '../db/schema.js';
import { authorize } from '../middleware/authorize.js';
import { ShipmentStateMachine } from '../services/shipment-state-machine.js';
import { generateReferenceCode } from '../services/reference-code.js';
import {
  shipmentCreateSchema,
  shipmentUpdateSchema,
  shipmentTransitionSchema,
  paginationSchema,
} from '@nexus-fleet/shared';

export const shipmentRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET / - List shipments with pagination, filtering, sorting
  // -------------------------------------------------------------------------
  fastify.get('/', async (request, reply) => {
    const tenantId = request.tenantId;
    const query = request.query as Record<string, string>;

    const pagination = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
    });

    const conditions = [
      eq(shipments.tenant_id, tenantId),
      eq(shipments.is_deleted, false),
    ];

    if (query.status) {
      conditions.push(eq(shipments.status, query.status));
    }

    if (query.priority) {
      conditions.push(eq(shipments.priority, query.priority));
    }

    if (query.search) {
      conditions.push(
        or(
          ilike(shipments.reference_code, `%${query.search}%`),
          ilike(shipments.customer_name, `%${query.search}%`),
        )!,
      );
    }

    // Sorting
    const sortField = query.sort ?? 'created_at';
    const sortDir = query.order === 'asc' ? asc : desc;

    const sortColumn =
      sortField === 'priority' ? shipments.priority :
      sortField === 'status' ? shipments.status :
      sortField === 'customer_name' ? shipments.customer_name :
      shipments.created_at;

    const offset = (pagination.page - 1) * pagination.pageSize;

    const [items, [totalResult]] = await Promise.all([
      db
        .select()
        .from(shipments)
        .where(and(...conditions))
        .orderBy(sortDir(sortColumn))
        .limit(pagination.pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(shipments)
        .where(and(...conditions)),
    ]);

    const totalItems = totalResult?.count ?? 0;

    return reply.send({
      success: true,
      data: items,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pagination.pageSize),
      },
    });
  });

  // -------------------------------------------------------------------------
  // POST / - Create draft shipment
  // -------------------------------------------------------------------------
  fastify.post(
    '/',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const parsed = shipmentCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const referenceCode = await generateReferenceCode(tenantId);

      const [shipment] = await db
        .insert(shipments)
        .values({
          tenant_id: tenantId,
          reference_code: referenceCode,
          status: 'draft',
          priority: parsed.data.priority,
          customer_name: parsed.data.customer_name,
          origin_address: parsed.data.origin_address,
          origin_lat: String(parsed.data.origin_lat),
          origin_lng: String(parsed.data.origin_lng),
          dest_address: parsed.data.dest_address,
          dest_lat: String(parsed.data.dest_lat),
          dest_lng: String(parsed.data.dest_lng),
          cargo_description: parsed.data.cargo_description,
          cargo_weight_kg: String(parsed.data.cargo_weight_kg),
          cargo_volume_m3: String(parsed.data.cargo_volume_m3),
          cargo_type: parsed.data.cargo_type,
          requires_temp_control: parsed.data.requires_temp_control,
          temp_min_c: parsed.data.temp_min_c != null ? String(parsed.data.temp_min_c) : null,
          temp_max_c: parsed.data.temp_max_c != null ? String(parsed.data.temp_max_c) : null,
          scheduled_pickup_at: parsed.data.scheduled_pickup_at
            ? new Date(parsed.data.scheduled_pickup_at)
            : null,
        })
        .returning();

      // Create initial event
      await db.insert(shipmentEvents).values({
        tenant_id: tenantId,
        shipment_id: shipment.id,
        from_status: null,
        to_status: 'draft',
        action: 'create',
        actor_id: request.user.userId,
        data: {},
      });

      return reply.status(201).send({ success: true, data: shipment });
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id
  // -------------------------------------------------------------------------
  fastify.get('/:id', async (request, reply) => {
    const tenantId = request.tenantId;
    const { id } = request.params as { id: string };

    const [shipment] = await db
      .select()
      .from(shipments)
      .where(
        and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId), eq(shipments.is_deleted, false)),
      )
      .limit(1);

    if (!shipment) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found' },
      });
    }

    return reply.send({ success: true, data: shipment });
  });

  // -------------------------------------------------------------------------
  // PUT /:id - Update draft only
  // -------------------------------------------------------------------------
  fastify.put(
    '/:id',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const parsed = shipmentUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      const [existing] = await db
        .select()
        .from(shipments)
        .where(
          and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId), eq(shipments.is_deleted, false)),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Shipment not found' },
        });
      }

      if (existing.status !== 'draft') {
        return reply.status(422).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Only draft shipments can be updated' },
        });
      }

      const updateData: Record<string, any> = { updated_at: new Date() };
      const data = parsed.data;

      if (data.customer_name !== undefined) updateData.customer_name = data.customer_name;
      if (data.origin_address !== undefined) updateData.origin_address = data.origin_address;
      if (data.origin_lat !== undefined) updateData.origin_lat = String(data.origin_lat);
      if (data.origin_lng !== undefined) updateData.origin_lng = String(data.origin_lng);
      if (data.dest_address !== undefined) updateData.dest_address = data.dest_address;
      if (data.dest_lat !== undefined) updateData.dest_lat = String(data.dest_lat);
      if (data.dest_lng !== undefined) updateData.dest_lng = String(data.dest_lng);
      if (data.cargo_description !== undefined) updateData.cargo_description = data.cargo_description;
      if (data.cargo_weight_kg !== undefined) updateData.cargo_weight_kg = String(data.cargo_weight_kg);
      if (data.cargo_volume_m3 !== undefined) updateData.cargo_volume_m3 = String(data.cargo_volume_m3);
      if (data.cargo_type !== undefined) updateData.cargo_type = data.cargo_type;
      if (data.requires_temp_control !== undefined) updateData.requires_temp_control = data.requires_temp_control;
      if (data.temp_min_c !== undefined) updateData.temp_min_c = String(data.temp_min_c);
      if (data.temp_max_c !== undefined) updateData.temp_max_c = String(data.temp_max_c);
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.scheduled_pickup_at !== undefined) updateData.scheduled_pickup_at = new Date(data.scheduled_pickup_at);

      const [updated] = await db
        .update(shipments)
        .set(updateData)
        .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId)))
        .returning();

      return reply.send({ success: true, data: updated });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /:id - Soft delete (draft only)
  // -------------------------------------------------------------------------
  fastify.delete(
    '/:id',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(shipments)
        .where(
          and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId), eq(shipments.is_deleted, false)),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Shipment not found' },
        });
      }

      if (existing.status !== 'draft') {
        return reply.status(422).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Only draft shipments can be deleted' },
        });
      }

      await db
        .update(shipments)
        .set({ is_deleted: true, updated_at: new Date() })
        .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId)));

      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // POST /:id/transition - State machine transition
  // -------------------------------------------------------------------------
  fastify.post(
    '/:id/transition',
    { preHandler: [authorize('owner', 'admin', 'dispatcher')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { id } = request.params as { id: string };

      const parsed = shipmentTransitionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
        });
      }

      try {
        const result = await ShipmentStateMachine.transition(
          id,
          parsed.data.action,
          parsed.data.data ?? {},
          {
            tenantId,
            userId: request.user.userId,
          },
        );

        return reply.send({ success: true, data: result });
      } catch (err: any) {
        const statusCode = err.statusCode ?? 422;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: err.code ?? 'TRANSITION_ERROR',
            message: err.message,
          },
        });
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /:id/events - Event/audit history
  // -------------------------------------------------------------------------
  fastify.get('/:id/events', async (request, reply) => {
    const tenantId = request.tenantId;
    const { id } = request.params as { id: string };

    // Verify shipment exists and belongs to tenant
    const [shipment] = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(
        and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId)),
      )
      .limit(1);

    if (!shipment) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found' },
      });
    }

    const events = await db
      .select()
      .from(shipmentEvents)
      .where(
        and(eq(shipmentEvents.shipment_id, id), eq(shipmentEvents.tenant_id, tenantId)),
      )
      .orderBy(desc(shipmentEvents.created_at));

    return reply.send({ success: true, data: events });
  });
};
