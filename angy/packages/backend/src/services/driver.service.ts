import { eq, and, or, ilike, count, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { drivers, vehicles } from '../db/schema.js';
import { VEHICLE_LICENSE_REQUIREMENTS } from '@nexus-fleet/shared';
import { ServiceError } from './vehicle.service.js';

interface ListParams {
  tenantId: string;
  status?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export async function list(params: ListParams) {
  const { tenantId, page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)];

  if (params.status) {
    const statuses = params.status.split(',').map((s) => s.trim()) as any[];
    conditions.push(inArray(drivers.status, statuses));
  }
  if (params.search) {
    conditions.push(
      or(
        ilike(drivers.first_name, `%${params.search}%`),
        ilike(drivers.last_name, `%${params.search}%`),
        ilike(drivers.employee_id, `%${params.search}%`),
      )!,
    );
  }

  const where = and(...conditions);

  const sortColumn = params.sort === 'name' ? drivers.first_name
    : params.sort === 'employee_id' ? drivers.employee_id
    : drivers.created_at;
  const orderFn = params.order === 'asc' ? asc : desc;

  const [items, [total]] = await Promise.all([
    db.select().from(drivers).where(where).orderBy(orderFn(sortColumn)).limit(limit).offset(offset),
    db.select({ count: count() }).from(drivers).where(where),
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
  const [driver] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId)))
    .limit(1);

  if (!driver) throw new ServiceError('Driver not found', 404, 'NOT_FOUND');
  return driver;
}

export async function create(tenantId: string, data: any, maxDrivers: number) {
  const [{ count: currentCount }] = await db
    .select({ count: count() })
    .from(drivers)
    .where(and(eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)));

  if (currentCount >= maxDrivers) {
    throw new ServiceError(
      `Driver limit reached (${maxDrivers}). Upgrade your plan.`,
      409,
      'LIMIT_REACHED',
    );
  }

  const [driver] = await db
    .insert(drivers)
    .values({
      tenant_id: tenantId,
      employee_id: data.email.split('@')[0] + '-' + Date.now().toString(36),
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      license_number: data.license_number,
      license_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      license_classes: data.license_class ? [data.license_class] : [],
    })
    .returning()
    .catch((err: any) => {
      if (err.code === '23505') {
        throw new ServiceError(
          'Driver with this employee ID or license number already exists for this tenant',
          409,
          'DUPLICATE',
        );
      }
      throw err;
    });

  return driver;
}

export async function update(tenantId: string, id: string, data: any) {
  const existing = await getById(tenantId, id);

  const updateData: any = {};
  if (data.first_name !== undefined) updateData.first_name = data.first_name;
  if (data.last_name !== undefined) updateData.last_name = data.last_name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.license_number !== undefined) updateData.license_number = data.license_number;
  if (data.license_class !== undefined) updateData.license_classes = [data.license_class];
  if (data.status !== undefined) updateData.status = data.status;

  if (Object.keys(updateData).length === 0) return existing;

  const [driver] = await db
    .update(drivers)
    .set(updateData)
    .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId)))
    .returning()
    .catch((err: any) => {
      if (err.code === '23505') {
        throw new ServiceError(
          'Driver with this employee ID or license number already exists for this tenant',
          409,
          'DUPLICATE',
        );
      }
      throw err;
    });

  return driver;
}

export async function softDelete(tenantId: string, id: string) {
  const driver = await getById(tenantId, id);

  if (driver.status === 'driving') {
    throw new ServiceError('Cannot deactivate a driver who is currently driving', 409, 'IN_USE');
  }

  const [updated] = await db
    .update(drivers)
    .set({ is_active: false })
    .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenantId)))
    .returning();

  return updated;
}

export async function assignVehicle(tenantId: string, driverId: string, vehicleId: string) {
  const driver = await getById(tenantId, driverId);
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.tenant_id, tenantId)))
    .limit(1);

  if (!vehicle) throw new ServiceError('Vehicle not found', 404, 'NOT_FOUND');

  // Rule 1: Driver not already assigned
  if (driver.current_vehicle_id) {
    throw new ServiceError('Driver is already assigned to a vehicle', 409, 'ALREADY_ASSIGNED');
  }

  // Rule 2: Vehicle not already assigned
  if (vehicle.assigned_driver_id) {
    throw new ServiceError('Vehicle is already assigned to a driver', 409, 'VEHICLE_ASSIGNED');
  }

  // Rule 3: Both must be available
  if (driver.status !== 'available') {
    throw new ServiceError('Driver is not available', 409, 'DRIVER_UNAVAILABLE');
  }
  if (vehicle.status !== 'available') {
    throw new ServiceError('Vehicle is not available', 409, 'VEHICLE_UNAVAILABLE');
  }

  // Rule 4: License class check
  const requiredClass = VEHICLE_LICENSE_REQUIREMENTS[vehicle.type as keyof typeof VEHICLE_LICENSE_REQUIREMENTS];
  if (requiredClass && !driver.license_classes.includes(requiredClass)) {
    throw new ServiceError(
      `Driver lacks required license class ${requiredClass} for vehicle type ${vehicle.type}`,
      409,
      'LICENSE_MISMATCH',
    );
  }

  // Rule 5: License not expired
  if (new Date(driver.license_expiry) < new Date()) {
    throw new ServiceError('Driver license has expired', 409, 'LICENSE_EXPIRED');
  }

  // Perform assignment
  await db.transaction(async (tx) => {
    await tx
      .update(drivers)
      .set({ current_vehicle_id: vehicleId })
      .where(eq(drivers.id, driverId));
    await tx
      .update(vehicles)
      .set({ assigned_driver_id: driverId })
      .where(eq(vehicles.id, vehicleId));
  });

  return { driver_id: driverId, vehicle_id: vehicleId };
}

export async function unassignVehicle(tenantId: string, driverId: string) {
  const driver = await getById(tenantId, driverId);

  if (!driver.current_vehicle_id) {
    throw new ServiceError('Driver is not assigned to any vehicle', 409, 'NOT_ASSIGNED');
  }

  if (driver.status === 'driving') {
    throw new ServiceError('Cannot unassign vehicle while driver is driving', 409, 'DRIVER_DRIVING');
  }

  const vehicleId = driver.current_vehicle_id;

  await db.transaction(async (tx) => {
    await tx
      .update(drivers)
      .set({ current_vehicle_id: null })
      .where(eq(drivers.id, driverId));
    await tx
      .update(vehicles)
      .set({ assigned_driver_id: null })
      .where(eq(vehicles.id, vehicleId));
  });

  return { driver_id: driverId, vehicle_id: vehicleId };
}
