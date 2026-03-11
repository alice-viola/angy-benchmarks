import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, ilike, inArray, desc, asc, sql, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { shipments, shipmentEvents } from '../db/schema.js';
import {
  createShipmentSchema,
  updateShipmentSchema,
  shipmentTransitionSchema,
  shipmentFilterSchema,
} from '@nexus-fleet/shared';
import { SHIPMENT_TRANSITIONS } from '@nexus-fleet/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePoint(lng: number, lat: number) {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

const SORT_COLUMNS: Record<string, typeof shipments.createdAt> = {
  created_at: shipments.createdAt,
  updated_at: shipments.updatedAt,
  scheduled_pickup: shipments.scheduledPickup as any,
  scheduled_delivery: shipments.scheduledDelivery as any,
  priority: shipments.priority as any,
  status: shipments.status as any,
  reference_code: shipments.referenceCode as any,
};

function resolveAction(currentStatus: string, action: string): string | null {
  const allowed = SHIPMENT_TRANSITIONS[currentStatus];
  if (!allowed) return null;

  const actionToTarget: Record<string, string> = {
    confirm: 'confirmed',
    assign: 'assigned',
    pickup: 'picked_up',
    deliver: 'delivered',
    fail: 'failed',
    complete: 'completed',
    cancel: 'cancelled',
  };

  const target = actionToTarget[action];
  if (!target || !allowed.includes(target)) return null;
  return target;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default async function shipmentRoutes(fastify: FastifyInstance) {
  // GET / – list shipments
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const query = shipmentFilterSchema.parse(request.query);
    const { page, limit, sortBy, sortOrder, search } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(shipments.tenantId, tenantId)];

    if (query.status) {
      const statuses = (query.status as string).split(',');
      conditions.push(inArray(shipments.status, statuses));
    }
    if (query.priority) {
      const priorities = (query.priority as string).split(',');
      conditions.push(inArray(shipments.priority, priorities));
    }
    if (query.cargoType) {
      conditions.push(eq(shipments.cargoType, query.cargoType));
    }
    if (search) {
      conditions.push(
        or(
          ilike(shipments.referenceCode, `%${search}%`),
          ilike(shipments.recipientName, `%${search}%`),
        )!,
      );
    }
    if (query.from) {
      conditions.push(sql`${shipments.scheduledPickup} >= ${query.from}`);
    }
    if (query.to) {
      conditions.push(sql`${shipments.scheduledPickup} <= ${query.to}`);
    }

    const where = and(...conditions);

    const sortCol = (sortBy && SORT_COLUMNS[sortBy.replace(/^-/, '')]) || shipments.createdAt;
    const direction =
      sortBy?.startsWith('-') ? desc(sortCol) : sortOrder === 'asc' ? asc(sortCol) : desc(sortCol);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(shipments)
        .where(where)
        .orderBy(direction)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(shipments).where(where),
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

  // POST / – create draft shipment
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const body = createShipmentSchema.parse(request.body);

    const originLat = body.pickupAddress.lat;
    const originLng = body.pickupAddress.lng;
    const destLat = body.deliveryAddress.lat;
    const destLng = body.deliveryAddress.lng;

    const originAddressStr = [
      body.pickupAddress.street,
      body.pickupAddress.city,
      body.pickupAddress.state,
      body.pickupAddress.postalCode,
      body.pickupAddress.country,
    ].join(', ');

    const destAddressStr = [
      body.deliveryAddress.street,
      body.deliveryAddress.city,
      body.deliveryAddress.state,
      body.deliveryAddress.postalCode,
      body.deliveryAddress.country,
    ].join(', ');

    const [shipment] = await db
      .insert(shipments)
      .values({
        tenantId,
        referenceCode: body.referenceNumber,
        status: 'draft',
        priority: body.priority ?? 'normal',
        cargoType: body.cargoType ?? 'general',
        cargoDescription: body.cargoDescription,
        weightKg: body.weightKg?.toString(),
        volumeM3: body.volumeM3?.toString(),
        originAddress: originAddressStr,
        originLocation:
          originLat != null && originLng != null
            ? sql`ST_SetSRID(ST_MakePoint(${originLng}, ${originLat}), 4326)`
            : undefined,
        destAddress: destAddressStr,
        destLocation:
          destLat != null && destLng != null
            ? sql`ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326)`
            : undefined,
        scheduledPickup: new Date(body.scheduledPickup),
        scheduledDelivery: new Date(body.scheduledDelivery),
        recipientName: body.customerName,
        recipientPhone: body.customerPhone,
        notes: body.notes,
      } as any)
      .returning();

    await db.insert(shipmentEvents).values({
      shipmentId: shipment.id,
      status: 'draft',
      actorId: request.user!.userId,
      notes: 'Shipment created',
    });

    return reply.status(201).send({ success: true, data: shipment });
  });

  // GET /:id – get shipment by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [shipment] = await db
      .select()
      .from(shipments)
      .where(and(eq(shipments.id, id), eq(shipments.tenantId, tenantId)));

    if (!shipment) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found' },
      });
    }

    return reply.send({ success: true, data: shipment });
  });

  // PUT /:id – update shipment (draft or confirmed only)
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;
    const body = updateShipmentSchema.parse(request.body);

    const [existing] = await db
      .select()
      .from(shipments)
      .where(and(eq(shipments.id, id), eq(shipments.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found' },
      });
    }

    if (!['draft', 'confirmed'].includes(existing.status)) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot update shipment in "${existing.status}" status`,
        },
      });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };

    if (body.priority) updateValues.priority = body.priority;
    if (body.cargoType) updateValues.cargoType = body.cargoType;
    if (body.cargoDescription !== undefined) updateValues.cargoDescription = body.cargoDescription;
    if (body.weightKg) updateValues.weightKg = body.weightKg.toString();
    if (body.volumeM3 !== undefined) updateValues.volumeM3 = body.volumeM3?.toString();
    if (body.customerName) updateValues.recipientName = body.customerName;
    if (body.customerPhone !== undefined) updateValues.recipientPhone = body.customerPhone;
    if (body.notes !== undefined) updateValues.notes = body.notes;
    if (body.scheduledPickup) updateValues.scheduledPickup = new Date(body.scheduledPickup);
    if (body.scheduledDelivery) updateValues.scheduledDelivery = new Date(body.scheduledDelivery);

    if (body.pickupAddress) {
      const addr = body.pickupAddress;
      updateValues.originAddress = [addr.street, addr.city, addr.state, addr.postalCode, addr.country].join(', ');
      if (addr.lat != null && addr.lng != null) {
        updateValues.originLocation = makePoint(addr.lng, addr.lat);
      }
    }
    if (body.deliveryAddress) {
      const addr = body.deliveryAddress;
      updateValues.destAddress = [addr.street, addr.city, addr.state, addr.postalCode, addr.country].join(', ');
      if (addr.lat != null && addr.lng != null) {
        updateValues.destLocation = makePoint(addr.lng, addr.lat);
      }
    }

    const [updated] = await db
      .update(shipments)
      .set(updateValues)
      .where(and(eq(shipments.id, id), eq(shipments.tenantId, tenantId)))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:id – soft delete (draft only)
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { id } = request.params;

    const [existing] = await db
      .select()
      .from(shipments)
      .where(and(eq(shipments.id, id), eq(shipments.tenantId, tenantId)));

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shipment not found' },
      });
    }

    if (existing.status !== 'draft') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Only draft shipments can be deleted',
        },
      });
    }

    const [updated] = await db
      .update(shipments)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(shipments.id, id), eq(shipments.tenantId, tenantId)))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // POST /:id/transition – state machine transition
  fastify.post(
    '/:id/transition',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenantId, userId } = request.user!;
      const { id } = request.params;
      const body = shipmentTransitionSchema.parse(request.body);

      const [existing] = await db
        .select()
        .from(shipments)
        .where(and(eq(shipments.id, id), eq(shipments.tenantId, tenantId)));

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Shipment not found' },
        });
      }

      const targetStatus = resolveAction(existing.status, body.action);
      if (!targetStatus) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot "${body.action}" from "${existing.status}"`,
            details: {
              currentStatus: existing.status,
              allowedTargets: SHIPMENT_TRANSITIONS[existing.status] ?? [],
            },
          },
        });
      }

      const updateValues: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: new Date(),
      };

      if (body.action === 'assign') {
        if (body.vehicleId) updateValues.vehicleId = body.vehicleId;
        if (body.driverId) updateValues.driverId = body.driverId;
      }
      if (body.action === 'pickup') {
        updateValues.actualPickup = new Date();
      }
      if (body.action === 'deliver') {
        updateValues.actualDelivery = new Date();
      }
      if (body.action === 'fail') {
        updateValues.failureReason = body.notes;
      }

      const [updated] = await db
        .update(shipments)
        .set(updateValues)
        .where(and(eq(shipments.id, id), eq(shipments.tenantId, tenantId)))
        .returning();

      await db.insert(shipmentEvents).values({
        shipmentId: id,
        status: targetStatus,
        previousStatus: existing.status,
        actorId: userId,
        notes: body.notes,
      });

      return reply.send({ success: true, data: updated });
    },
  );

  // GET /:id/events – shipment event history
  fastify.get(
    '/:id/events',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenantId } = request.user!;
      const { id } = request.params;

      const [shipment] = await db
        .select({ id: shipments.id })
        .from(shipments)
        .where(and(eq(shipments.id, id), eq(shipments.tenantId, tenantId)));

      if (!shipment) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Shipment not found' },
        });
      }

      const events = await db
        .select()
        .from(shipmentEvents)
        .where(eq(shipmentEvents.shipmentId, id))
        .orderBy(desc(shipmentEvents.createdAt));

      return reply.send({ success: true, data: events });
    },
  );
}
