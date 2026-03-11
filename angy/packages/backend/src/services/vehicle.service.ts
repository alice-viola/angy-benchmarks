import { eq, and, or, ilike, sql, desc, asc, count, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles } from '../db/schema.js';

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string = 'SERVICE_ERROR',
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

interface ListParams {
  tenantId: string;
  status?: string;
  type?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export async function list(params: ListParams) {
  const { tenantId, page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(vehicles.tenant_id, tenantId), eq(vehicles.is_active, true)];

  if (params.status) {
    const statuses = params.status.split(',').map((s) => s.trim()) as any[];
    conditions.push(inArray(vehicles.status, statuses));
  }
  if (params.type) {
    const types = params.type.split(',').map((s) => s.trim()) as any[];
    conditions.push(inArray(vehicles.type, types));
  }
  if (params.search) {
    conditions.push(
      or(
        ilike(vehicles.registration, `%${params.search}%`),
        ilike(vehicles.vin, `%${params.search}%`),
      )!,
    );
  }

  const where = and(...conditions);

  const sortColumn = params.sort === 'make' ? vehicles.make
    : params.sort === 'year' ? vehicles.year
    : params.sort === 'registration' ? vehicles.registration
    : vehicles.created_at;
  const orderFn = params.order === 'asc' ? asc : desc;

  const [items, [total]] = await Promise.all([
    db.select().from(vehicles).where(where).orderBy(orderFn(sortColumn)).limit(limit).offset(offset),
    db.select({ count: count() }).from(vehicles).where(where),
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
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenantId)))
    .limit(1);

  if (!vehicle) throw new ServiceError('Vehicle not found', 404, 'NOT_FOUND');
  return vehicle;
}

export async function create(tenantId: string, data: any, maxVehicles: number) {
  // Enforce tenant max_vehicles
  const [{ count: currentCount }] = await db
    .select({ count: count() })
    .from(vehicles)
    .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.is_active, true)));

  if (currentCount >= maxVehicles) {
    throw new ServiceError(
      `Vehicle limit reached (${maxVehicles}). Upgrade your plan.`,
      409,
      'LIMIT_REACHED',
    );
  }

  const [vehicle] = await db
    .insert(vehicles)
    .values({
      tenant_id: tenantId,
      registration: data.plate_number,
      vin: data.plate_number.replace(/\s/g, '').slice(0, 17).padEnd(17, '0'), // fallback VIN
      make: data.make,
      model: data.model,
      year: data.year,
      type: data.vehicle_type,
      capacity_kg: data.max_weight_kg?.toString() ?? null,
      capacity_m3: data.max_volume_m3?.toString() ?? null,
    })
    .returning()
    .catch((err: any) => {
      if (err.code === '23505') {
        throw new ServiceError(
          'Vehicle with this registration or VIN already exists for this tenant',
          409,
          'DUPLICATE',
        );
      }
      throw err;
    });

  return vehicle;
}

export async function update(tenantId: string, id: string, data: any) {
  const existing = await getById(tenantId, id);

  const updateData: any = {};
  if (data.plate_number !== undefined) updateData.registration = data.plate_number;
  if (data.make !== undefined) updateData.make = data.make;
  if (data.model !== undefined) updateData.model = data.model;
  if (data.year !== undefined) updateData.year = data.year;
  if (data.vehicle_type !== undefined) updateData.type = data.vehicle_type;
  if (data.max_weight_kg !== undefined) updateData.capacity_kg = data.max_weight_kg?.toString();
  if (data.max_volume_m3 !== undefined) updateData.capacity_m3 = data.max_volume_m3?.toString();
  if (data.status !== undefined) updateData.status = data.status;

  if (Object.keys(updateData).length === 0) return existing;

  const [vehicle] = await db
    .update(vehicles)
    .set(updateData)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenantId)))
    .returning()
    .catch((err: any) => {
      if (err.code === '23505') {
        throw new ServiceError(
          'Vehicle with this registration or VIN already exists for this tenant',
          409,
          'DUPLICATE',
        );
      }
      throw err;
    });

  return vehicle;
}

export async function softDelete(tenantId: string, id: string) {
  const vehicle = await getById(tenantId, id);

  if (vehicle.status === 'in_transit') {
    throw new ServiceError('Cannot decommission a vehicle that is in transit', 409, 'IN_USE');
  }

  const [updated] = await db
    .update(vehicles)
    .set({ status: 'decommissioned', is_active: false })
    .where(and(eq(vehicles.id, id), eq(vehicles.tenant_id, tenantId)))
    .returning();

  return updated;
}
