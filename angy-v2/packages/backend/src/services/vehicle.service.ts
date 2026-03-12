import { eq, and, sql, desc, asc, SQL } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles, drivers, vehicleTokens } from '../db/schema.js';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

interface ListVehiclesParams {
  tenant_id: string;
  status?: string[];
  type?: string[];
  search?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}


function buildSortOrder(sortStr: string): SQL {
  const descending = sortStr.startsWith('-');
  const field = descending ? sortStr.slice(1) : sortStr;

  const columnMap: Record<string, any> = {
    created_at: vehicles.created_at,
    registration: vehicles.registration,
    make: vehicles.make,
    model: vehicles.model,
    year: vehicles.year,
    status: vehicles.status,
  };

  const column = columnMap[field] ?? vehicles.created_at;
  return descending ? desc(column) : asc(column);
}

export async function listVehicles(params: ListVehiclesParams) {
  const {
    tenant_id,
    status,
    type,
    search,
    sort = '-created_at',
    page = 1,
    page_size = 25,
  } = params;

  const conditions: SQL[] = [eq(vehicles.tenant_id, tenant_id)];

  if (status && status.length > 0) {
    conditions.push(
      sql`${vehicles.status} IN (${sql.join(
        status.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }

  if (type && type.length > 0) {
    conditions.push(
      sql`${vehicles.type} IN (${sql.join(
        type.map((t) => sql`${t}`),
        sql`, `,
      )})`,
    );
  }

  if (search) {
    conditions.push(
      sql`(${vehicles.registration} ILIKE ${'%' + search + '%'} OR ${vehicles.make} ILIKE ${'%' + search + '%'} OR ${vehicles.model} ILIKE ${'%' + search + '%'})`,
    );
  }

  const whereClause = and(...conditions)!;

  // Count total
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vehicles)
    .where(whereClause);

  const total_items = count;
  const total_pages = Math.ceil(total_items / page_size);
  const offset = (page - 1) * page_size;

  // Fetch with location extraction
  const rows = await db
    .select({
      id: vehicles.id,
      registration: vehicles.registration,
      vin: vehicles.vin,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      type: vehicles.type,
      capacity_kg: vehicles.capacity_kg,
      capacity_m3: vehicles.capacity_m3,
      status: vehicles.status,
      last_location_lat: sql<number | null>`CASE WHEN ${vehicles.last_location} IS NOT NULL THEN ST_Y(${vehicles.last_location}::geometry) ELSE NULL END`,
      last_location_lng: sql<number | null>`CASE WHEN ${vehicles.last_location} IS NOT NULL THEN ST_X(${vehicles.last_location}::geometry) ELSE NULL END`,
      last_location_at: vehicles.last_location_at,
      last_speed_kmh: vehicles.last_speed_kmh,
      heading: vehicles.heading,
      assigned_driver_id: vehicles.assigned_driver_id,
      is_active: vehicles.is_active,
      created_at: vehicles.created_at,
    })
    .from(vehicles)
    .where(whereClause)
    .orderBy(buildSortOrder(sort))
    .limit(page_size)
    .offset(offset);

  const data = rows.map((r) => ({
    id: r.id,
    registration: r.registration,
    vin: r.vin,
    make: r.make,
    model: r.model,
    year: r.year,
    type: r.type,
    capacity_kg: Number(r.capacity_kg),
    capacity_m3: Number(r.capacity_m3),
    status: r.status,
    last_location:
      r.last_location_lat != null && r.last_location_lng != null
        ? { lat: Number(r.last_location_lat), lng: Number(r.last_location_lng) }
        : null,
    last_location_at: r.last_location_at?.toISOString() ?? null,
    last_speed_kmh: r.last_speed_kmh != null ? Number(r.last_speed_kmh) : null,
    heading: r.heading != null ? Number(r.heading) : null,
    assigned_driver_id: r.assigned_driver_id,
    is_active: r.is_active,
    created_at: r.created_at?.toISOString() ?? '',
  }));

  return {
    data,
    meta: { page, page_size, total_items, total_pages },
  };
}

export async function createVehicle(
  tenant_id: string,
  created_by: string,
  input: {
    registration: string;
    vin: string;
    make: string;
    model: string;
    year: number;
    type: string;
    capacity_kg: number;
    capacity_m3: number;
  },
) {
  const [vehicle] = await db
    .insert(vehicles)
    .values({
      tenant_id,
      created_by,
      registration: input.registration,
      vin: input.vin,
      make: input.make,
      model: input.model,
      year: input.year,
      type: input.type,
      capacity_kg: String(input.capacity_kg),
      capacity_m3: String(input.capacity_m3),
      status: 'available',
    })
    .returning();

  return formatVehicle(vehicle);
}

export async function getVehicleById(id: string, tenant_id: string) {
  const rows = await db
    .select({
      id: vehicles.id,
      registration: vehicles.registration,
      vin: vehicles.vin,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      type: vehicles.type,
      capacity_kg: vehicles.capacity_kg,
      capacity_m3: vehicles.capacity_m3,
      status: vehicles.status,
      last_location_lat: sql<number | null>`CASE WHEN ${vehicles.last_location} IS NOT NULL THEN ST_Y(${vehicles.last_location}::geometry) ELSE NULL END`,
      last_location_lng: sql<number | null>`CASE WHEN ${vehicles.last_location} IS NOT NULL THEN ST_X(${vehicles.last_location}::geometry) ELSE NULL END`,
      last_location_at: vehicles.last_location_at,
      last_speed_kmh: vehicles.last_speed_kmh,
      heading: vehicles.heading,
      assigned_driver_id: vehicles.assigned_driver_id,
      is_active: vehicles.is_active,
      created_at: vehicles.created_at,
      driver_id: drivers.id,
      driver_first_name: drivers.first_name,
      driver_last_name: drivers.last_name,
    })
    .from(vehicles)
    .leftJoin(drivers, eq(vehicles.assigned_driver_id, drivers.id))
    .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenant_id)))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r.id,
    registration: r.registration,
    vin: r.vin,
    make: r.make,
    model: r.model,
    year: r.year,
    type: r.type,
    capacity_kg: Number(r.capacity_kg),
    capacity_m3: Number(r.capacity_m3),
    status: r.status,
    last_location:
      r.last_location_lat != null && r.last_location_lng != null
        ? { lat: Number(r.last_location_lat), lng: Number(r.last_location_lng) }
        : null,
    last_location_at: r.last_location_at?.toISOString() ?? null,
    last_speed_kmh: r.last_speed_kmh != null ? Number(r.last_speed_kmh) : null,
    heading: r.heading != null ? Number(r.heading) : null,
    assigned_driver_id: r.assigned_driver_id,
    assigned_driver: r.driver_id
      ? {
          id: r.driver_id,
          first_name: r.driver_first_name ?? '',
          last_name: r.driver_last_name ?? '',
        }
      : null,
    is_active: r.is_active,
    created_at: r.created_at?.toISOString() ?? '',
  };
}

export async function updateVehicle(
  id: string,
  tenant_id: string,
  input: Record<string, any>,
) {
  const updateData: Record<string, any> = { updated_at: new Date() };

  if (input.registration !== undefined) updateData.registration = input.registration;
  if (input.vin !== undefined) updateData.vin = input.vin;
  if (input.make !== undefined) updateData.make = input.make;
  if (input.model !== undefined) updateData.model = input.model;
  if (input.year !== undefined) updateData.year = input.year;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.capacity_kg !== undefined) updateData.capacity_kg = String(input.capacity_kg);
  if (input.capacity_m3 !== undefined) updateData.capacity_m3 = String(input.capacity_m3);

  const [updated] = await db
    .update(vehicles)
    .set(updateData)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenant_id)))
    .returning();

  if (!updated) return null;
  return formatVehicle(updated);
}

export async function softDeleteVehicle(id: string, tenant_id: string) {
  // Check current status
  const [vehicle] = await db
    .select({ status: vehicles.status })
    .from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenant_id)))
    .limit(1);

  if (!vehicle) return { error: 'NOT_FOUND' as const };

  if (vehicle.status === 'in_transit') {
    return { error: 'IN_TRANSIT' as const };
  }

  await db
    .update(vehicles)
    .set({ status: 'decommissioned', is_active: false, updated_at: new Date() })
    .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenant_id)));

  return { error: null };
}

export async function generateVehicleToken(vehicle_id: string, tenant_id: string) {
  // Verify vehicle exists and belongs to tenant
  const [vehicle] = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicle_id), eq(vehicles.tenant_id, tenant_id)))
    .limit(1);

  if (!vehicle) return null;

  const plaintext = crypto.randomBytes(32).toString('hex');
  const token_hash = await bcrypt.hash(plaintext, 12);
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Upsert: delete existing then insert
  await db
    .delete(vehicleTokens)
    .where(eq(vehicleTokens.vehicle_id, vehicle_id));

  await db.insert(vehicleTokens).values({
    tenant_id,
    vehicle_id,
    token_hash,
    is_active: true,
    expires_at,
  });

  return {
    token: plaintext,
    expires_at: expires_at.toISOString(),
  };
}

export async function revokeVehicleToken(vehicle_id: string, tenant_id: string) {
  // Verify vehicle exists
  const [vehicle] = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicle_id), eq(vehicles.tenant_id, tenant_id)))
    .limit(1);

  if (!vehicle) return false;

  await db
    .update(vehicleTokens)
    .set({ is_active: false })
    .where(eq(vehicleTokens.vehicle_id, vehicle_id));

  return true;
}

function formatVehicle(v: typeof vehicles.$inferSelect) {
  return {
    id: v.id,
    registration: v.registration,
    vin: v.vin,
    make: v.make,
    model: v.model,
    year: v.year,
    type: v.type,
    capacity_kg: Number(v.capacity_kg),
    capacity_m3: Number(v.capacity_m3),
    status: v.status,
    last_location: null as { lat: number; lng: number } | null,
    last_location_at: v.last_location_at?.toISOString() ?? null,
    last_speed_kmh: v.last_speed_kmh != null ? Number(v.last_speed_kmh) : null,
    heading: v.heading != null ? Number(v.heading) : null,
    assigned_driver_id: v.assigned_driver_id,
    is_active: v.is_active,
    created_at: v.created_at?.toISOString() ?? '',
  };
}
