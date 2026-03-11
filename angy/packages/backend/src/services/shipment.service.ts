import { eq, and, or, ilike, count, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { shipments, shipmentEvents, vehicles, drivers } from '../db/schema.js';
import { ServiceError } from './vehicle.service.js';

interface ListParams {
  tenantId: string;
  status?: string;
  priority?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export async function list(params: ListParams) {
  const { tenantId, page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(shipments.tenant_id, tenantId)];

  if (params.status) {
    const statuses = params.status.split(',').map((s) => s.trim()) as any[];
    conditions.push(inArray(shipments.status, statuses));
  }
  if (params.priority) {
    const priorities = params.priority.split(',').map((s) => s.trim()) as any[];
    conditions.push(inArray(shipments.priority, priorities));
  }
  if (params.search) {
    conditions.push(
      or(
        ilike(shipments.reference_code, `%${params.search}%`),
        ilike(shipments.customer_name, `%${params.search}%`),
      )!,
    );
  }

  const where = and(...conditions);

  const sortColumn = params.sort === 'customer_name' ? shipments.customer_name
    : params.sort === 'priority' ? shipments.priority
    : params.sort === 'status' ? shipments.status
    : shipments.created_at;
  const orderFn = params.order === 'asc' ? asc : desc;

  const [items, [total]] = await Promise.all([
    db.select().from(shipments).where(where).orderBy(orderFn(sortColumn)).limit(limit).offset(offset),
    db.select({ count: count() }).from(shipments).where(where),
  ]);

  return {
    data: items,
    meta: {
      totalItems: total.count,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total.count / limit),
    },
  };
}

export async function getById(tenantId: string, id: string) {
  const [shipment] = await db
    .select()
    .from(shipments)
    .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId)))
    .limit(1);

  if (!shipment) throw new ServiceError('Shipment not found', 404, 'NOT_FOUND');

  // Include assigned vehicle and driver info
  let assigned_vehicle = null;
  let assigned_driver = null;

  if (shipment.assigned_vehicle_id) {
    const [v] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, shipment.assigned_vehicle_id))
      .limit(1);
    assigned_vehicle = v || null;
  }

  if (shipment.assigned_driver_id) {
    const [d] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.id, shipment.assigned_driver_id))
      .limit(1);
    assigned_driver = d || null;
  }

  return { ...shipment, assigned_vehicle, assigned_driver };
}

export async function getEvents(tenantId: string, shipmentId: string) {
  // Verify shipment exists and belongs to tenant
  const [shipment] = await db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.id, shipmentId), eq(shipments.tenant_id, tenantId)))
    .limit(1);

  if (!shipment) throw new ServiceError('Shipment not found', 404, 'NOT_FOUND');

  const events = await db
    .select()
    .from(shipmentEvents)
    .where(eq(shipmentEvents.shipment_id, shipmentId))
    .orderBy(desc(shipmentEvents.created_at));

  return events;
}

export async function create(tenantId: string, data: any, userId: string) {
  const [shipment] = await db
    .insert(shipments)
    .values({
      tenant_id: tenantId,
      status: 'draft',
      customer_name: data.customer_name,
      origin_address: data.origin_address,
      origin_lat: data.origin_lat?.toString(),
      origin_lng: data.origin_lng?.toString(),
      dest_address: data.dest_address,
      dest_lat: data.dest_lat?.toString(),
      dest_lng: data.dest_lng?.toString(),
      cargo_description: data.cargo_description || '',
      cargo_weight_kg: data.cargo_weight_kg?.toString(),
      cargo_volume_m3: data.cargo_volume_m3?.toString(),
      cargo_type: data.cargo_type || 'general',
      requires_temp_control: data.requires_temp_control || false,
      temp_min_c: data.temp_min_c?.toString() ?? null,
      temp_max_c: data.temp_max_c?.toString() ?? null,
      priority: data.priority || 'normal',
      scheduled_pickup_at: data.scheduled_pickup_at ? new Date(data.scheduled_pickup_at) : null,
      created_by: userId,
    })
    .returning();

  return shipment;
}

export async function update(tenantId: string, id: string, data: any) {
  const existing = await getById(tenantId, id);

  if (existing.status !== 'draft') {
    throw new ServiceError('Can only update shipments in draft status', 409, 'NOT_DRAFT');
  }

  const updateData: any = {};
  if (data.customer_name !== undefined) updateData.customer_name = data.customer_name;
  if (data.origin_address !== undefined) updateData.origin_address = data.origin_address;
  if (data.origin_lat !== undefined) updateData.origin_lat = data.origin_lat.toString();
  if (data.origin_lng !== undefined) updateData.origin_lng = data.origin_lng.toString();
  if (data.dest_address !== undefined) updateData.dest_address = data.dest_address;
  if (data.dest_lat !== undefined) updateData.dest_lat = data.dest_lat.toString();
  if (data.dest_lng !== undefined) updateData.dest_lng = data.dest_lng.toString();
  if (data.cargo_description !== undefined) updateData.cargo_description = data.cargo_description;
  if (data.cargo_weight_kg !== undefined) updateData.cargo_weight_kg = data.cargo_weight_kg?.toString();
  if (data.cargo_volume_m3 !== undefined) updateData.cargo_volume_m3 = data.cargo_volume_m3?.toString();
  if (data.cargo_type !== undefined) updateData.cargo_type = data.cargo_type;
  if (data.requires_temp_control !== undefined) updateData.requires_temp_control = data.requires_temp_control;
  if (data.temp_min_c !== undefined) updateData.temp_min_c = data.temp_min_c?.toString();
  if (data.temp_max_c !== undefined) updateData.temp_max_c = data.temp_max_c?.toString();
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.scheduled_pickup_at !== undefined) {
    updateData.scheduled_pickup_at = data.scheduled_pickup_at ? new Date(data.scheduled_pickup_at) : null;
  }

  if (Object.keys(updateData).length === 0) return existing;

  const [shipment] = await db
    .update(shipments)
    .set(updateData)
    .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId)))
    .returning();

  return shipment;
}

export async function softDelete(tenantId: string, id: string) {
  const shipment = await getById(tenantId, id);

  if (shipment.status !== 'draft') {
    throw new ServiceError('Can only delete shipments in draft status', 409, 'NOT_DRAFT');
  }

  await db
    .delete(shipments)
    .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenantId)));

  return { deleted: true };
}
