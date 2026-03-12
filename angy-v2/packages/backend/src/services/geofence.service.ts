import { eq, and, sql, desc, asc, SQL } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { geofences } from '../db/schema.js';

interface ListGeofencesParams {
  tenant_id: string;
  is_active?: boolean;
  sort?: string;
  page?: number;
  page_size?: number;
}

function buildSortOrder(sortStr: string): SQL {
  const descending = sortStr.startsWith('-');
  const field = descending ? sortStr.slice(1) : sortStr;
  const columnMap: Record<string, any> = {
    created_at: geofences.created_at,
    name: geofences.name,
    radius_m: geofences.radius_m,
  };
  const column = columnMap[field] ?? geofences.created_at;
  return descending ? desc(column) : asc(column);
}

export async function listGeofences(params: ListGeofencesParams) {
  const {
    tenant_id,
    is_active,
    sort = '-created_at',
    page = 1,
    page_size = 25,
  } = params;

  const conditions: SQL[] = [eq(geofences.tenant_id, tenant_id)];
  if (is_active !== undefined) {
    conditions.push(eq(geofences.is_active, is_active));
  }

  const whereClause = and(...conditions)!;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(geofences)
    .where(whereClause);

  const total_items = count;
  const total_pages = Math.ceil(total_items / page_size);
  const offset = (page - 1) * page_size;

  const rows = await db
    .select()
    .from(geofences)
    .where(whereClause)
    .orderBy(buildSortOrder(sort))
    .limit(page_size)
    .offset(offset);

  const data = rows.map(formatGeofence);

  return { data, meta: { page, page_size, total_items, total_pages } };
}

export async function createGeofence(
  tenant_id: string,
  created_by: string,
  input: {
    name: string;
    center_lat: number;
    center_lng: number;
    radius_m: number;
    color?: string;
    trigger_on_enter?: boolean;
    trigger_on_exit?: boolean;
  },
) {
  const [row] = await db
    .insert(geofences)
    .values({
      tenant_id,
      created_by,
      name: input.name,
      center_lat: String(input.center_lat),
      center_lng: String(input.center_lng),
      radius_m: String(input.radius_m),
      color: input.color ?? '#3B82F6',
      trigger_on_enter: input.trigger_on_enter ?? true,
      trigger_on_exit: input.trigger_on_exit ?? true,
      geometry: sql`ST_Buffer(
        ST_SetSRID(ST_MakePoint(${input.center_lng}, ${input.center_lat}), 4326)::geography,
        ${input.radius_m}
      )::geometry`,
    })
    .returning();

  return formatGeofence(row);
}

export async function getGeofenceById(id: string, tenant_id: string) {
  const [row] = await db
    .select()
    .from(geofences)
    .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenant_id)))
    .limit(1);

  if (!row) return null;
  return formatGeofence(row);
}

export async function updateGeofence(
  id: string,
  tenant_id: string,
  input: Record<string, any>,
) {
  const updateData: Record<string, any> = { updated_at: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.center_lat !== undefined) updateData.center_lat = String(input.center_lat);
  if (input.center_lng !== undefined) updateData.center_lng = String(input.center_lng);
  if (input.radius_m !== undefined) updateData.radius_m = String(input.radius_m);
  if (input.color !== undefined) updateData.color = input.color;
  if (input.trigger_on_enter !== undefined) updateData.trigger_on_enter = input.trigger_on_enter;
  if (input.trigger_on_exit !== undefined) updateData.trigger_on_exit = input.trigger_on_exit;

  const [updated] = await db
    .update(geofences)
    .set(updateData)
    .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenant_id)))
    .returning();

  if (!updated) return null;
  return formatGeofence(updated);
}

export async function softDeleteGeofence(id: string, tenant_id: string) {
  const [row] = await db
    .select({ id: geofences.id })
    .from(geofences)
    .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenant_id)))
    .limit(1);

  if (!row) return { error: 'NOT_FOUND' as const };

  await db
    .update(geofences)
    .set({ is_active: false, updated_at: new Date() })
    .where(and(eq(geofences.id, id), eq(geofences.tenant_id, tenant_id)));

  return { error: null };
}

function formatGeofence(g: typeof geofences.$inferSelect) {
  return {
    id: g.id,
    name: g.name,
    center: { lat: Number(g.center_lat), lng: Number(g.center_lng) },
    radius_m: Number(g.radius_m),
    color: g.color ?? '#3B82F6',
    trigger_on_enter: g.trigger_on_enter ?? true,
    trigger_on_exit: g.trigger_on_exit ?? true,
    is_active: g.is_active ?? true,
    created_at: g.created_at?.toISOString() ?? '',
  };
}
