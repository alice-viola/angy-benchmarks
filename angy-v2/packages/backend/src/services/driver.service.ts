import { eq, and, sql, desc, asc, SQL } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { drivers, vehicles } from '../db/schema.js';
import { VEHICLE_TYPE_LICENSE_MAP } from '@nexusfleet/shared';

interface ListDriversParams {
  tenant_id: string;
  status?: string[];
  search?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

function buildSortOrder(sortStr: string): SQL {
  const descending = sortStr.startsWith('-');
  const field = descending ? sortStr.slice(1) : sortStr;

  const columnMap: Record<string, any> = {
    created_at: drivers.created_at,
    first_name: drivers.first_name,
    last_name: drivers.last_name,
    employee_id: drivers.employee_id,
    status: drivers.status,
  };

  const column = columnMap[field] ?? drivers.created_at;
  return descending ? desc(column) : asc(column);
}

function formatDriver(d: typeof drivers.$inferSelect) {
  return {
    id: d.id,
    employee_id: d.employee_id,
    first_name: d.first_name ?? '',
    last_name: d.last_name ?? '',
    phone: d.phone ?? '',
    license_number: d.license_number ?? '',
    license_expiry: d.license_expiry ?? '',
    license_classes: d.license_classes ?? [],
    status: d.status ?? 'off_duty',
    current_vehicle_id: d.current_vehicle_id,
    max_driving_hours_day: Number(d.max_driving_hours_day ?? 9),
    current_driving_hours: Number(d.current_driving_hours ?? 0),
    is_active: d.is_active ?? true,
  };
}

export async function listDrivers(params: ListDriversParams) {
  const {
    tenant_id,
    status,
    search,
    sort = '-created_at',
    page = 1,
    page_size = 25,
  } = params;

  const conditions: SQL[] = [eq(drivers.tenant_id, tenant_id)];

  if (status && status.length > 0) {
    conditions.push(
      sql`${drivers.status} IN (${sql.join(
        status.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }

  if (search) {
    conditions.push(
      sql`(${drivers.first_name} ILIKE ${'%' + search + '%'} OR ${drivers.last_name} ILIKE ${'%' + search + '%'} OR ${drivers.employee_id} ILIKE ${'%' + search + '%'})`,
    );
  }

  const whereClause = and(...conditions)!;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(drivers)
    .where(whereClause);

  const total_items = count;
  const total_pages = Math.ceil(total_items / page_size);
  const offset = (page - 1) * page_size;

  const rows = await db
    .select()
    .from(drivers)
    .where(whereClause)
    .orderBy(buildSortOrder(sort))
    .limit(page_size)
    .offset(offset);

  return {
    data: rows.map(formatDriver),
    meta: { page, page_size, total_items, total_pages },
  };
}

export async function createDriver(
  tenant_id: string,
  created_by: string,
  input: {
    employee_id: string;
    first_name: string;
    last_name: string;
    phone: string;
    license_number: string;
    license_expiry: string;
    license_classes: string[];
    max_driving_hours_day?: number;
  },
) {
  const [driver] = await db
    .insert(drivers)
    .values({
      tenant_id,
      created_by,
      employee_id: input.employee_id,
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
      license_number: input.license_number,
      license_expiry: input.license_expiry,
      license_classes: input.license_classes,
      max_driving_hours_day: String(input.max_driving_hours_day ?? 9.0),
      status: 'off_duty',
    })
    .returning();

  return formatDriver(driver);
}

export async function getDriverById(id: string, tenant_id: string) {
  const rows = await db
    .select({
      driver: drivers,
      vehicle_id: vehicles.id,
      vehicle_registration: vehicles.registration,
      vehicle_make: vehicles.make,
      vehicle_model: vehicles.model,
    })
    .from(drivers)
    .leftJoin(vehicles, eq(drivers.current_vehicle_id, vehicles.id))
    .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenant_id)))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    ...formatDriver(r.driver),
    current_vehicle: r.vehicle_id
      ? {
          id: r.vehicle_id,
          registration: r.vehicle_registration ?? '',
          make: r.vehicle_make ?? '',
          model: r.vehicle_model ?? '',
        }
      : null,
  };
}

export async function updateDriver(
  id: string,
  tenant_id: string,
  input: Record<string, any>,
) {
  const updateData: Record<string, any> = { updated_at: new Date() };

  if (input.employee_id !== undefined) updateData.employee_id = input.employee_id;
  if (input.first_name !== undefined) updateData.first_name = input.first_name;
  if (input.last_name !== undefined) updateData.last_name = input.last_name;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.license_number !== undefined) updateData.license_number = input.license_number;
  if (input.license_expiry !== undefined) updateData.license_expiry = input.license_expiry;
  if (input.license_classes !== undefined) updateData.license_classes = input.license_classes;
  if (input.max_driving_hours_day !== undefined)
    updateData.max_driving_hours_day = String(input.max_driving_hours_day);
  if (input.status !== undefined) updateData.status = input.status;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;
  if (input.current_vehicle_id !== undefined) updateData.current_vehicle_id = input.current_vehicle_id;

  const [updated] = await db
    .update(drivers)
    .set(updateData)
    .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenant_id)))
    .returning();

  if (!updated) return null;
  return formatDriver(updated);
}

export async function softDeleteDriver(id: string, tenant_id: string) {
  const [driver] = await db
    .select({ status: drivers.status })
    .from(drivers)
    .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenant_id)))
    .limit(1);

  if (!driver) return { error: 'NOT_FOUND' as const };

  if (driver.status === 'driving') {
    return { error: 'DRIVING' as const };
  }

  await db
    .update(drivers)
    .set({ is_active: false, updated_at: new Date() })
    .where(and(eq(drivers.id, id), eq(drivers.tenant_id, tenant_id)));

  return { error: null };
}

export async function assignVehicle(
  driver_id: string,
  vehicle_id: string,
  tenant_id: string,
) {
  // Fetch driver and vehicle
  const [driver] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.id, driver_id), eq(drivers.tenant_id, tenant_id)))
    .limit(1);

  if (!driver) return { error: 'Driver not found', code: 'NOT_FOUND' as const };

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicle_id), eq(vehicles.tenant_id, tenant_id)))
    .limit(1);

  if (!vehicle) return { error: 'Vehicle not found', code: 'NOT_FOUND' as const };

  // Guard 1: Driver status must be available
  if (driver.status !== 'available') {
    return {
      error: `Driver status is '${driver.status}', must be 'available'`,
      code: 'ASSIGNMENT_FAILED' as const,
    };
  }

  // Guard 2: Vehicle status must be available
  if (vehicle.status !== 'available') {
    return {
      error: `Vehicle status is '${vehicle.status}', must be 'available'`,
      code: 'ASSIGNMENT_FAILED' as const,
    };
  }

  // Guard 3: License class match
  const requiredClass = VEHICLE_TYPE_LICENSE_MAP[vehicle.type ?? ''];
  if (requiredClass && !(driver.license_classes ?? []).includes(requiredClass)) {
    return {
      error: `Driver does not have required license class '${requiredClass}' for vehicle type '${vehicle.type}'`,
      code: 'ASSIGNMENT_FAILED' as const,
    };
  }

  // Guard 4: License not expired
  if (driver.license_expiry && new Date(driver.license_expiry) <= new Date()) {
    return {
      error: 'Driver license has expired',
      code: 'ASSIGNMENT_FAILED' as const,
    };
  }

  // Guard 5: Driver not already assigned
  if (driver.current_vehicle_id) {
    return {
      error: 'Driver is already assigned to a vehicle',
      code: 'ASSIGNMENT_FAILED' as const,
    };
  }

  // Guard 6: Vehicle not already assigned
  if (vehicle.assigned_driver_id) {
    return {
      error: 'Vehicle is already assigned to a driver',
      code: 'ASSIGNMENT_FAILED' as const,
    };
  }

  // Transaction: assign both
  const result = await db.transaction(async (tx) => {
    const [updatedDriver] = await tx
      .update(drivers)
      .set({ current_vehicle_id: vehicle_id, updated_at: new Date() })
      .where(eq(drivers.id, driver_id))
      .returning();

    await tx
      .update(vehicles)
      .set({ assigned_driver_id: driver_id, updated_at: new Date() })
      .where(eq(vehicles.id, vehicle_id));

    return updatedDriver;
  });

  return { data: formatDriver(result), code: null };
}

export async function unassignVehicle(driver_id: string, tenant_id: string) {
  const [driver] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.id, driver_id), eq(drivers.tenant_id, tenant_id)))
    .limit(1);

  if (!driver) return { error: 'Driver not found', code: 'NOT_FOUND' as const };

  if (driver.status === 'driving') {
    return {
      error: 'Cannot unassign vehicle while driver is driving',
      code: 'CONFLICT' as const,
    };
  }

  const vehicleId = driver.current_vehicle_id;

  const result = await db.transaction(async (tx) => {
    const [updatedDriver] = await tx
      .update(drivers)
      .set({ current_vehicle_id: null, updated_at: new Date() })
      .where(eq(drivers.id, driver_id))
      .returning();

    if (vehicleId) {
      await tx
        .update(vehicles)
        .set({ assigned_driver_id: null, updated_at: new Date() })
        .where(eq(vehicles.id, vehicleId));
    }

    return updatedDriver;
  });

  return { data: formatDriver(result), code: null };
}
