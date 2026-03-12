import { eq, and, sql, desc, asc, SQL } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { shipments, shipmentEvents, vehicles, drivers, users } from '../db/schema.js';
import { ACTION_TO_TRANSITION } from '@nexusfleet/shared';
import { executeTransition } from './shipment-state-machine.js';

interface ListShipmentsParams {
  tenant_id: string;
  status?: string[];
  priority?: string[];
  search?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

function buildSortOrder(sortStr: string): SQL {
  const descending = sortStr.startsWith('-');
  const field = descending ? sortStr.slice(1) : sortStr;

  const columnMap: Record<string, any> = {
    created_at: shipments.created_at,
    updated_at: shipments.updated_at,
    reference_code: shipments.reference_code,
    customer_name: shipments.customer_name,
    status: shipments.status,
    priority: shipments.priority,
    scheduled_pickup_at: shipments.scheduled_pickup_at,
  };

  const column = columnMap[field] ?? shipments.created_at;
  return descending ? desc(column) : asc(column);
}

export async function listShipments(params: ListShipmentsParams) {
  const {
    tenant_id,
    status,
    priority,
    search,
    sort = '-created_at',
    page = 1,
    page_size = 25,
  } = params;

  const conditions: SQL[] = [eq(shipments.tenant_id, tenant_id)];

  if (status && status.length > 0) {
    conditions.push(
      sql`${shipments.status} IN (${sql.join(
        status.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }

  if (priority && priority.length > 0) {
    conditions.push(
      sql`${shipments.priority} IN (${sql.join(
        priority.map((p) => sql`${p}`),
        sql`, `,
      )})`,
    );
  }

  if (search) {
    conditions.push(
      sql`(${shipments.reference_code} ILIKE ${'%' + search + '%'} OR ${shipments.customer_name} ILIKE ${'%' + search + '%'})`,
    );
  }

  const whereClause = and(...conditions)!;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shipments)
    .where(whereClause);

  const total_items = count;
  const total_pages = Math.ceil(total_items / page_size);
  const offset = (page - 1) * page_size;

  const rows = await db
    .select()
    .from(shipments)
    .where(whereClause)
    .orderBy(buildSortOrder(sort))
    .limit(page_size)
    .offset(offset);

  const data = rows.map((r) => ({
    id: r.id,
    reference_code: r.reference_code,
    status: r.status,
    priority: r.priority,
    customer_name: r.customer_name,
    origin_address: r.origin_address,
    dest_address: r.dest_address,
    cargo_description: r.cargo_description ?? '',
    cargo_weight_kg: Number(r.cargo_weight_kg ?? 0),
    cargo_volume_m3: Number(r.cargo_volume_m3 ?? 0),
    cargo_type: r.cargo_type ?? 'general',
    requires_temp_control: r.requires_temp_control ?? false,
    assigned_vehicle_id: r.assigned_vehicle_id,
    assigned_driver_id: r.assigned_driver_id,
    scheduled_pickup_at: r.scheduled_pickup_at?.toISOString() ?? null,
    created_at: r.created_at?.toISOString() ?? '',
    updated_at: r.updated_at?.toISOString() ?? '',
  }));

  return {
    data,
    meta: { page, page_size, total_items, total_pages },
  };
}

export async function createShipment(
  tenant_id: string,
  created_by: string,
  input: {
    customer_name: string;
    origin_address: string;
    origin_lat: number;
    origin_lng: number;
    dest_address: string;
    dest_lat: number;
    dest_lng: number;
    cargo_description: string;
    cargo_weight_kg: number;
    cargo_volume_m3: number;
    cargo_type: string;
    priority?: string;
    requires_temp_control?: boolean;
    temp_min_c?: number;
    temp_max_c?: number;
    scheduled_pickup_at?: string;
  },
) {
  const [shipment] = await db
    .insert(shipments)
    .values({
      tenant_id,
      created_by,
      customer_name: input.customer_name,
      origin_address: input.origin_address,
      origin_location: sql`ST_SetSRID(ST_MakePoint(${input.origin_lng}, ${input.origin_lat}), 4326)`,
      dest_address: input.dest_address,
      dest_location: sql`ST_SetSRID(ST_MakePoint(${input.dest_lng}, ${input.dest_lat}), 4326)`,
      cargo_description: input.cargo_description,
      cargo_weight_kg: String(input.cargo_weight_kg),
      cargo_volume_m3: String(input.cargo_volume_m3),
      cargo_type: input.cargo_type,
      priority: input.priority ?? 'normal',
      requires_temp_control: input.requires_temp_control ?? false,
      temp_min_c: input.temp_min_c != null ? String(input.temp_min_c) : null,
      temp_max_c: input.temp_max_c != null ? String(input.temp_max_c) : null,
      scheduled_pickup_at: input.scheduled_pickup_at ? new Date(input.scheduled_pickup_at) : null,
      status: 'draft',
      reference_code: null,
    })
    .returning();

  return formatShipmentBasic(shipment);
}

export async function getShipmentById(id: string, tenant_id: string) {
  const rows = await db
    .select({
      shipment: shipments,
      origin_lat: sql<number | null>`CASE WHEN ${shipments.origin_location} IS NOT NULL THEN ST_Y(${shipments.origin_location}::geometry) ELSE NULL END`,
      origin_lng: sql<number | null>`CASE WHEN ${shipments.origin_location} IS NOT NULL THEN ST_X(${shipments.origin_location}::geometry) ELSE NULL END`,
      dest_lat: sql<number | null>`CASE WHEN ${shipments.dest_location} IS NOT NULL THEN ST_Y(${shipments.dest_location}::geometry) ELSE NULL END`,
      dest_lng: sql<number | null>`CASE WHEN ${shipments.dest_location} IS NOT NULL THEN ST_X(${shipments.dest_location}::geometry) ELSE NULL END`,
      vehicle_id: vehicles.id,
      vehicle_registration: vehicles.registration,
      vehicle_make: vehicles.make,
      vehicle_model: vehicles.model,
      vehicle_type: vehicles.type,
      driver_id: drivers.id,
      driver_first_name: drivers.first_name,
      driver_last_name: drivers.last_name,
      driver_phone: drivers.phone,
    })
    .from(shipments)
    .leftJoin(vehicles, eq(shipments.assigned_vehicle_id, vehicles.id))
    .leftJoin(drivers, eq(shipments.assigned_driver_id, drivers.id))
    .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenant_id)))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  const s = r.shipment;

  return {
    id: s.id,
    reference_code: s.reference_code,
    status: s.status,
    priority: s.priority,
    customer_name: s.customer_name,
    origin_address: s.origin_address,
    origin_location:
      r.origin_lat != null && r.origin_lng != null
        ? { lat: Number(r.origin_lat), lng: Number(r.origin_lng) }
        : null,
    dest_address: s.dest_address,
    dest_location:
      r.dest_lat != null && r.dest_lng != null
        ? { lat: Number(r.dest_lat), lng: Number(r.dest_lng) }
        : null,
    cargo_description: s.cargo_description ?? '',
    cargo_weight_kg: Number(s.cargo_weight_kg ?? 0),
    cargo_volume_m3: Number(s.cargo_volume_m3 ?? 0),
    cargo_type: s.cargo_type ?? 'general',
    requires_temp_control: s.requires_temp_control ?? false,
    temp_min_c: s.temp_min_c != null ? Number(s.temp_min_c) : null,
    temp_max_c: s.temp_max_c != null ? Number(s.temp_max_c) : null,
    assigned_vehicle_id: s.assigned_vehicle_id,
    assigned_driver_id: s.assigned_driver_id,
    assigned_route_id: s.assigned_route_id,
    assigned_vehicle: r.vehicle_id
      ? {
          id: r.vehicle_id,
          registration: r.vehicle_registration ?? '',
          make: r.vehicle_make ?? '',
          model: r.vehicle_model ?? '',
          type: r.vehicle_type ?? '',
        }
      : null,
    assigned_driver: r.driver_id
      ? {
          id: r.driver_id,
          first_name: r.driver_first_name ?? '',
          last_name: r.driver_last_name ?? '',
          phone: r.driver_phone ?? '',
        }
      : null,
    scheduled_pickup_at: s.scheduled_pickup_at?.toISOString() ?? null,
    actual_pickup_at: s.actual_pickup_at?.toISOString() ?? null,
    actual_delivery_at: s.actual_delivery_at?.toISOString() ?? null,
    estimated_arrival_at: s.estimated_arrival_at?.toISOString() ?? null,
    pod_signature_url: s.pod_signature_url,
    pod_photo_urls: s.pod_photo_urls,
    pod_notes: s.pod_notes,
    failure_reason: s.failure_reason,
    cancellation_reason: s.cancellation_reason,
    created_by: s.created_by,
    created_at: s.created_at?.toISOString() ?? '',
    updated_at: s.updated_at?.toISOString() ?? '',
  };
}

export async function updateShipment(
  id: string,
  tenant_id: string,
  input: Record<string, any>,
) {
  // Check status first
  const [existing] = await db
    .select({ status: shipments.status })
    .from(shipments)
    .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenant_id)))
    .limit(1);

  if (!existing) return { error: 'NOT_FOUND' as const };
  if (existing.status !== 'draft') return { error: 'INVALID_STATE' as const };

  const updateData: Record<string, any> = { updated_at: new Date() };

  if (input.customer_name !== undefined) updateData.customer_name = input.customer_name;
  if (input.origin_address !== undefined) updateData.origin_address = input.origin_address;
  if (input.origin_lat !== undefined && input.origin_lng !== undefined) {
    updateData.origin_location = sql`ST_SetSRID(ST_MakePoint(${input.origin_lng}, ${input.origin_lat}), 4326)`;
  }
  if (input.dest_address !== undefined) updateData.dest_address = input.dest_address;
  if (input.dest_lat !== undefined && input.dest_lng !== undefined) {
    updateData.dest_location = sql`ST_SetSRID(ST_MakePoint(${input.dest_lng}, ${input.dest_lat}), 4326)`;
  }
  if (input.cargo_description !== undefined) updateData.cargo_description = input.cargo_description;
  if (input.cargo_weight_kg !== undefined) updateData.cargo_weight_kg = String(input.cargo_weight_kg);
  if (input.cargo_volume_m3 !== undefined) updateData.cargo_volume_m3 = String(input.cargo_volume_m3);
  if (input.cargo_type !== undefined) updateData.cargo_type = input.cargo_type;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.requires_temp_control !== undefined) updateData.requires_temp_control = input.requires_temp_control;
  if (input.temp_min_c !== undefined) updateData.temp_min_c = input.temp_min_c != null ? String(input.temp_min_c) : null;
  if (input.temp_max_c !== undefined) updateData.temp_max_c = input.temp_max_c != null ? String(input.temp_max_c) : null;
  if (input.scheduled_pickup_at !== undefined) {
    updateData.scheduled_pickup_at = input.scheduled_pickup_at ? new Date(input.scheduled_pickup_at) : null;
  }

  const [updated] = await db
    .update(shipments)
    .set(updateData)
    .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenant_id)))
    .returning();

  return { data: formatShipmentBasic(updated) };
}

export async function softDeleteShipment(id: string, tenant_id: string) {
  const [existing] = await db
    .select({ status: shipments.status })
    .from(shipments)
    .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenant_id)))
    .limit(1);

  if (!existing) return { error: 'NOT_FOUND' as const };
  if (existing.status !== 'draft') return { error: 'INVALID_STATE' as const };

  // Soft delete — we'll cancel/deactivate draft
  await db
    .update(shipments)
    .set({ status: 'cancelled', updated_at: new Date() })
    .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenant_id)));

  return { error: null };
}

export async function transitionShipment(
  id: string,
  tenant_id: string,
  user_id: string,
  action: string,
  data?: {
    vehicle_id?: string;
    driver_id?: string;
    pod_signature_url?: string;
    pod_photo_urls?: string[];
    failure_reason?: string;
    cancellation_reason?: string;
  },
) {
  // Handle cancel action specially — it can come from multiple states
  if (action === 'cancel') {
    const [shipment] = await db
      .select({ status: shipments.status })
      .from(shipments)
      .where(and(eq(shipments.id, id), eq(shipments.tenant_id, tenant_id)))
      .limit(1);

    if (!shipment) {
      return { error: 'Shipment not found', code: 'NOT_FOUND' as const };
    }

    const currentStatus = shipment.status!;
    const validCancelFrom = ['draft', 'confirmed', 'assigned'];
    if (!validCancelFrom.includes(currentStatus)) {
      return {
        error: `Cannot transition from ${currentStatus} to cancelled`,
        code: 'TRANSITION_FAILED' as const,
        guard: `Cannot cancel shipment in '${currentStatus}' status`,
      };
    }

    return executeTransition(id, tenant_id, user_id, currentStatus, 'cancelled', data);
  }

  // Lookup action → transition
  const transition = ACTION_TO_TRANSITION[action];
  if (!transition) {
    return {
      error: `Unknown action '${action}'`,
      code: 'TRANSITION_FAILED' as const,
    };
  }

  const autoChain = action === 'pickup' ? { nextTo: 'in_transit' } : undefined;

  return executeTransition(
    id,
    tenant_id,
    user_id,
    transition.from,
    transition.to,
    data,
    autoChain,
  );
}

export async function getShipmentEvents(shipment_id: string, tenant_id: string) {
  // Verify shipment belongs to tenant
  const [shipment] = await db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.id, shipment_id), eq(shipments.tenant_id, tenant_id)))
    .limit(1);

  if (!shipment) return null;

  const events = await db
    .select({
      id: shipmentEvents.id,
      event_type: shipmentEvents.event_type,
      from_status: shipmentEvents.from_status,
      to_status: shipmentEvents.to_status,
      notes: shipmentEvents.notes,
      metadata: shipmentEvents.metadata,
      created_by_id: shipmentEvents.created_by,
      created_at: shipmentEvents.created_at,
      user_id: users.id,
      user_first_name: users.first_name,
      user_last_name: users.last_name,
    })
    .from(shipmentEvents)
    .leftJoin(users, eq(shipmentEvents.created_by, users.id))
    .where(eq(shipmentEvents.shipment_id, shipment_id))
    .orderBy(asc(shipmentEvents.created_at));

  return events.map((e) => ({
    id: e.id,
    event_type: e.event_type,
    from_status: e.from_status,
    to_status: e.to_status,
    notes: e.notes,
    metadata: e.metadata ?? {},
    created_by: e.user_id
      ? {
          id: e.user_id,
          first_name: e.user_first_name ?? '',
          last_name: e.user_last_name ?? '',
        }
      : null,
    created_at: e.created_at?.toISOString() ?? '',
  }));
}

function formatShipmentBasic(s: typeof shipments.$inferSelect) {
  return {
    id: s.id,
    reference_code: s.reference_code,
    status: s.status,
    priority: s.priority,
    customer_name: s.customer_name,
    origin_address: s.origin_address,
    dest_address: s.dest_address,
    cargo_description: s.cargo_description ?? '',
    cargo_weight_kg: Number(s.cargo_weight_kg ?? 0),
    cargo_volume_m3: Number(s.cargo_volume_m3 ?? 0),
    cargo_type: s.cargo_type ?? 'general',
    requires_temp_control: s.requires_temp_control ?? false,
    temp_min_c: s.temp_min_c != null ? Number(s.temp_min_c) : null,
    temp_max_c: s.temp_max_c != null ? Number(s.temp_max_c) : null,
    assigned_vehicle_id: s.assigned_vehicle_id,
    assigned_driver_id: s.assigned_driver_id,
    assigned_route_id: s.assigned_route_id,
    scheduled_pickup_at: s.scheduled_pickup_at?.toISOString() ?? null,
    actual_pickup_at: s.actual_pickup_at?.toISOString() ?? null,
    actual_delivery_at: s.actual_delivery_at?.toISOString() ?? null,
    estimated_arrival_at: s.estimated_arrival_at?.toISOString() ?? null,
    pod_signature_url: s.pod_signature_url,
    pod_photo_urls: s.pod_photo_urls,
    pod_notes: s.pod_notes,
    failure_reason: s.failure_reason,
    cancellation_reason: s.cancellation_reason,
    created_by: s.created_by,
    created_at: s.created_at?.toISOString() ?? '',
    updated_at: s.updated_at?.toISOString() ?? '',
  };
}
