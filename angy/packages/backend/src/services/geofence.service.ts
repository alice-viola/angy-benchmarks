import { eq, and, count, desc, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { geofences, geofenceEvents } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { ServiceError } from './vehicle.service.js';

interface ListParams {
  tenantId: string;
  page: number;
  limit: number;
}

export async function list(params: ListParams) {
  const { tenantId, page, limit } = params;
  const offset = (page - 1) * limit;

  const where = eq(geofences.tenant_id, tenantId);

  const [items, [total]] = await Promise.all([
    db.select().from(geofences).where(where).orderBy(desc(geofences.created_at)).limit(limit).offset(offset),
    db.select({ count: count() }).from(geofences).where(where),
  ]);

  return {
    data: items,
    meta: { totalItems: total.count, page, pageSize: limit, totalPages: Math.ceil(total.count / limit) },
  };
}

export async function getById(tenantId: string, id: string) {
  const [geofence] = await db
    .select()
    .from(geofences)
    .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)))
    .limit(1);

  if (!geofence) throw new ServiceError('Geofence not found', 404, 'NOT_FOUND');
  return geofence;
}

export async function create(tenantId: string, data: any) {
  const centerLng = data.center_longitude;
  const centerLat = data.center_latitude;
  const radiusM = data.radius_meters || 100;

  const [geofence] = await db
    .insert(geofences)
    .values({
      tenant_id: tenantId,
      name: data.name,
      center: sql`ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)`,
      geometry: sql`ST_Buffer(ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)::geography, ${radiusM})::geometry`,
      radius_m: radiusM.toString(),
      trigger_on_enter: data.trigger_on_enter ?? true,
      trigger_on_exit: data.trigger_on_exit ?? true,
    })
    .returning();

  await invalidateCache(tenantId);
  return geofence;
}

export async function update(tenantId: string, id: string, data: any) {
  await getById(tenantId, id);

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.trigger_on_enter !== undefined) updateData.trigger_on_enter = data.trigger_on_enter;
  if (data.trigger_on_exit !== undefined) updateData.trigger_on_exit = data.trigger_on_exit;

  if (data.center_longitude !== undefined && data.center_latitude !== undefined) {
    const centerLng = data.center_longitude;
    const centerLat = data.center_latitude;
    const radiusM = data.radius_meters || 100;
    updateData.center = sql`ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)`;
    updateData.geometry = sql`ST_Buffer(ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)::geography, ${radiusM})::geometry`;
    if (data.radius_meters !== undefined) updateData.radius_m = radiusM.toString();
  }

  if (Object.keys(updateData).length === 0) {
    return getById(tenantId, id);
  }

  const [geofence] = await db
    .update(geofences)
    .set(updateData)
    .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)))
    .returning();

  await invalidateCache(tenantId);
  return geofence;
}

export async function softDelete(tenantId: string, id: string) {
  await getById(tenantId, id);

  await db
    .update(geofences)
    .set({ is_active: false })
    .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenantId)));

  await invalidateCache(tenantId);
  return { deleted: true };
}

export async function getEvents(tenantId: string, geofenceId: string, page: number, limit: number) {
  await getById(tenantId, geofenceId);
  const offset = (page - 1) * limit;

  const [items, [total]] = await Promise.all([
    db
      .select()
      .from(geofenceEvents)
      .where(and(eq(geofenceEvents.geofence_id, geofenceId), eq(geofenceEvents.tenant_id, tenantId)))
      .orderBy(desc(geofenceEvents.triggered_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(geofenceEvents)
      .where(and(eq(geofenceEvents.geofence_id, geofenceId), eq(geofenceEvents.tenant_id, tenantId))),
  ]);

  return {
    data: items,
    meta: { totalItems: total.count, page, pageSize: limit, totalPages: Math.ceil(total.count / limit) },
  };
}

export async function invalidateCache(tenantId: string) {
  try {
    await redis.del(`geofences:${tenantId}`);
  } catch {
    // non-critical
  }
}
