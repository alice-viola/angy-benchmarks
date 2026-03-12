import { eq, and, sql, desc, asc, SQL } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { routes, routeStops, vehicles, drivers, shipments, shipmentEvents } from '../db/schema.js';

interface ListRoutesParams {
  tenant_id: string;
  status?: string[];
  planned_date?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

function buildSortOrder(sortStr: string): SQL {
  const descending = sortStr.startsWith('-');
  const field = descending ? sortStr.slice(1) : sortStr;

  const columnMap: Record<string, any> = {
    created_at: routes.created_at,
    planned_date: routes.planned_date,
    name: routes.name,
    status: routes.status,
  };

  const column = columnMap[field] ?? routes.created_at;
  return descending ? desc(column) : asc(column);
}

export async function listRoutes(params: ListRoutesParams) {
  const {
    tenant_id,
    status,
    planned_date,
    sort = '-created_at',
    page = 1,
    page_size = 25,
  } = params;

  const conditions: SQL[] = [eq(routes.tenant_id, tenant_id)];

  if (status && status.length > 0) {
    conditions.push(
      sql`${routes.status} IN (${sql.join(
        status.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }

  if (planned_date) {
    conditions.push(eq(routes.planned_date, planned_date));
  }

  const whereClause = and(...conditions)!;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(routes)
    .where(whereClause);

  const total_items = count;
  const total_pages = Math.ceil(total_items / page_size);
  const offset = (page - 1) * page_size;

  // Fetch routes with stops_count
  const rows = await db
    .select({
      id: routes.id,
      name: routes.name,
      status: routes.status,
      vehicle_id: routes.vehicle_id,
      driver_id: routes.driver_id,
      planned_date: routes.planned_date,
      estimated_distance_km: routes.estimated_distance_km,
      optimization_score: routes.optimization_score,
      created_at: routes.created_at,
      stops_count: sql<number>`(SELECT count(*)::int FROM route_stops WHERE route_id = ${routes.id})`,
    })
    .from(routes)
    .where(whereClause)
    .orderBy(buildSortOrder(sort))
    .limit(page_size)
    .offset(offset);

  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    vehicle_id: r.vehicle_id,
    driver_id: r.driver_id,
    planned_date: r.planned_date ?? '',
    estimated_distance_km: r.estimated_distance_km != null ? Number(r.estimated_distance_km) : null,
    optimization_score: r.optimization_score != null ? Number(r.optimization_score) : null,
    stops_count: r.stops_count,
    created_at: r.created_at?.toISOString() ?? '',
  }));

  return {
    data,
    meta: { page, page_size, total_items, total_pages },
  };
}

export async function createRoute(
  tenant_id: string,
  created_by: string,
  input: {
    name: string;
    planned_date: string;
    vehicle_id?: string;
    driver_id?: string;
    stops?: Array<{
      shipment_id?: string;
      stop_type: string;
      lat: number;
      lng: number;
      address: string;
      sequence_order: number;
    }>;
  },
) {
  const result = await db.transaction(async (tx) => {
    // Build polyline from stops if provided
    let polylineSql = null;
    if (input.stops && input.stops.length >= 2) {
      polylineSql = sql`ST_SetSRID(ST_MakeLine(ARRAY[${sql.raw(
        input.stops
          .sort((a, b) => a.sequence_order - b.sequence_order)
          .map((s) => `ST_MakePoint(${s.lng}, ${s.lat})`)
          .join(','),
      )}]::geometry[]), 4326)`;
    }

    const routeValues: any = {
      tenant_id,
      created_by,
      name: input.name,
      planned_date: input.planned_date,
      vehicle_id: input.vehicle_id ?? null,
      driver_id: input.driver_id ?? null,
      status: 'draft',
    };

    if (polylineSql) {
      routeValues.polyline = polylineSql;
    }

    const [route] = await tx
      .insert(routes)
      .values(routeValues)
      .returning();

    // Insert stops
    let stopsData: any[] = [];
    if (input.stops && input.stops.length > 0) {
      const stopValues = input.stops.map((s) => ({
        route_id: route.id,
        shipment_id: s.shipment_id ?? null,
        stop_type: s.stop_type,
        sequence_order: s.sequence_order,
        location: sql`ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)`,
        address: s.address,
        status: 'pending',
      }));

      stopsData = await tx.insert(routeStops).values(stopValues).returning();
    }

    return { route, stops: stopsData };
  });

  return await formatRouteWithStops(result.route, result.stops);
}

export async function getRouteById(id: string, tenant_id: string) {
  const [route] = await db
    .select({
      route: routes,
      vehicle_id: vehicles.id,
      vehicle_registration: vehicles.registration,
      vehicle_make: vehicles.make,
      vehicle_model: vehicles.model,
      vehicle_capacity_kg: vehicles.capacity_kg,
      vehicle_capacity_m3: vehicles.capacity_m3,
      driver_id: drivers.id,
      driver_first_name: drivers.first_name,
      driver_last_name: drivers.last_name,
      polyline_json: sql<string | null>`CASE WHEN ${routes.polyline} IS NOT NULL THEN ST_AsGeoJSON(${routes.polyline})::text ELSE NULL END`,
    })
    .from(routes)
    .leftJoin(vehicles, eq(routes.vehicle_id, vehicles.id))
    .leftJoin(drivers, eq(routes.driver_id, drivers.id))
    .where(and(eq(routes.id, id), eq(routes.tenant_id, tenant_id)))
    .limit(1);

  if (!route) return null;

  // Fetch stops with location extraction
  const stops = await db
    .select({
      id: routeStops.id,
      shipment_id: routeStops.shipment_id,
      stop_type: routeStops.stop_type,
      sequence_order: routeStops.sequence_order,
      lat: sql<number | null>`CASE WHEN ${routeStops.location} IS NOT NULL THEN ST_Y(${routeStops.location}::geometry) ELSE NULL END`,
      lng: sql<number | null>`CASE WHEN ${routeStops.location} IS NOT NULL THEN ST_X(${routeStops.location}::geometry) ELSE NULL END`,
      address: routeStops.address,
      planned_arrival: routeStops.planned_arrival,
      actual_arrival: routeStops.actual_arrival,
      status: routeStops.status,
    })
    .from(routeStops)
    .where(eq(routeStops.route_id, id))
    .orderBy(asc(routeStops.sequence_order));

  const r = route.route;
  let polyline = null;
  if (route.polyline_json) {
    try {
      polyline = JSON.parse(route.polyline_json);
    } catch {
      polyline = null;
    }
  }

  return {
    id: r.id,
    name: r.name,
    status: r.status,
    vehicle_id: r.vehicle_id,
    driver_id: r.driver_id,
    planned_date: r.planned_date ?? '',
    estimated_distance_km: r.estimated_distance_km != null ? Number(r.estimated_distance_km) : null,
    optimization_score: r.optimization_score != null ? Number(r.optimization_score) : null,
    polyline,
    vehicle: route.vehicle_id
      ? {
          id: route.vehicle_id,
          registration: route.vehicle_registration ?? '',
          make: route.vehicle_make ?? '',
          model: route.vehicle_model ?? '',
          capacity_kg: Number(route.vehicle_capacity_kg ?? 0),
          capacity_m3: Number(route.vehicle_capacity_m3 ?? 0),
        }
      : null,
    driver: route.driver_id
      ? {
          id: route.driver_id,
          first_name: route.driver_first_name ?? '',
          last_name: route.driver_last_name ?? '',
        }
      : null,
    stops: stops.map((s) => ({
      id: s.id,
      shipment_id: s.shipment_id,
      stop_type: s.stop_type,
      sequence_order: s.sequence_order,
      location:
        s.lat != null && s.lng != null
          ? { lat: Number(s.lat), lng: Number(s.lng) }
          : { lat: 0, lng: 0 },
      address: s.address ?? '',
      planned_arrival: s.planned_arrival?.toISOString() ?? null,
      actual_arrival: s.actual_arrival?.toISOString() ?? null,
      status: s.status ?? 'pending',
    })),
    created_at: r.created_at?.toISOString() ?? '',
    updated_at: r.updated_at?.toISOString() ?? '',
  };
}

export async function updateRoute(
  id: string,
  tenant_id: string,
  input: Record<string, any>,
) {
  const updateData: Record<string, any> = { updated_at: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.planned_date !== undefined) updateData.planned_date = input.planned_date;
  if (input.vehicle_id !== undefined) updateData.vehicle_id = input.vehicle_id;
  if (input.driver_id !== undefined) updateData.driver_id = input.driver_id;

  const [updated] = await db
    .update(routes)
    .set(updateData)
    .where(and(eq(routes.id, id), eq(routes.tenant_id, tenant_id)))
    .returning();

  if (!updated) return null;

  return getRouteById(id, tenant_id);
}

export async function softDeleteRoute(id: string, tenant_id: string) {
  const [route] = await db
    .select({ status: routes.status })
    .from(routes)
    .where(and(eq(routes.id, id), eq(routes.tenant_id, tenant_id)))
    .limit(1);

  if (!route) return { error: 'NOT_FOUND' as const };
  if (route.status !== 'draft') return { error: 'INVALID_STATE' as const };

  // Delete stops first, then route
  await db.transaction(async (tx) => {
    await tx.delete(routeStops).where(eq(routeStops.route_id, id));
    await tx.delete(routes).where(and(eq(routes.id, id), eq(routes.tenant_id, tenant_id)));
  });

  return { error: null };
}

export async function bulkReorderStops(
  route_id: string,
  tenant_id: string,
  stops: Array<{ id: string; sequence_order: number }>,
) {
  // Verify route belongs to tenant
  const [route] = await db
    .select({ id: routes.id })
    .from(routes)
    .where(and(eq(routes.id, route_id), eq(routes.tenant_id, tenant_id)))
    .limit(1);

  if (!route) return null;

  await db.transaction(async (tx) => {
    for (const stop of stops) {
      await tx
        .update(routeStops)
        .set({ sequence_order: stop.sequence_order })
        .where(and(eq(routeStops.id, stop.id), eq(routeStops.route_id, route_id)));
    }
  });

  return getRouteById(route_id, tenant_id);
}

export async function completeStop(
  route_id: string,
  stop_id: string,
  tenant_id: string,
  user_id: string,
  podData?: {
    pod_signature_url?: string;
    pod_photo_urls?: string[];
    pod_notes?: string;
  },
) {
  // Verify route belongs to tenant
  const [route] = await db
    .select({ id: routes.id })
    .from(routes)
    .where(and(eq(routes.id, route_id), eq(routes.tenant_id, tenant_id)))
    .limit(1);

  if (!route) return { error: 'NOT_FOUND' as const, data: null };

  // Fetch stop
  const [stop] = await db
    .select()
    .from(routeStops)
    .where(and(eq(routeStops.id, stop_id), eq(routeStops.route_id, route_id)))
    .limit(1);

  if (!stop) return { error: 'NOT_FOUND' as const, data: null };

  // Handle delivery stop with linked shipment
  if (stop.stop_type === 'delivery' && stop.shipment_id) {
    // Fetch shipment
    const [shipment] = await db
      .select()
      .from(shipments)
      .where(and(eq(shipments.id, stop.shipment_id), eq(shipments.tenant_id, tenant_id)))
      .limit(1);

    if (shipment) {
      const hasPodInRequest = podData?.pod_signature_url || (podData?.pod_photo_urls && podData.pod_photo_urls.length > 0);
      const hasPodOnShipment = shipment.pod_signature_url || (shipment.pod_photo_urls && shipment.pod_photo_urls.length > 0);

      if (!hasPodInRequest && !hasPodOnShipment) {
        return {
          error: 'TRANSITION_FAILED' as const,
          data: null,
          guard: 'At least pod_signature_url or one pod_photo_urls entry is required',
        };
      }

      // Write POD data to shipment and trigger transition in same transaction
      await db.transaction(async (tx) => {
        // Write POD data if provided
        if (podData) {
          const podUpdate: Record<string, any> = {};
          if (podData.pod_signature_url) podUpdate.pod_signature_url = podData.pod_signature_url;
          if (podData.pod_photo_urls) podUpdate.pod_photo_urls = podData.pod_photo_urls;
          if (podData.pod_notes) podUpdate.pod_notes = podData.pod_notes;
          if (Object.keys(podUpdate).length > 0) {
            podUpdate.updated_at = new Date();
            await tx
              .update(shipments)
              .set(podUpdate)
              .where(eq(shipments.id, stop.shipment_id!));
          }
        }

        // Transition shipment in_transit → delivered
        if (shipment.status === 'in_transit') {
          await tx
            .update(shipments)
            .set({
              status: 'delivered',
              actual_delivery_at: new Date(),
              updated_at: new Date(),
            })
            .where(eq(shipments.id, stop.shipment_id!));

          await tx.insert(shipmentEvents).values({
            tenant_id,
            shipment_id: stop.shipment_id!,
            event_type: 'status_change',
            from_status: 'in_transit',
            to_status: 'delivered',
            created_by: user_id,
            metadata: { via: 'stop_completion' },
          });
        }

        // Complete the stop
        await tx
          .update(routeStops)
          .set({ status: 'completed', actual_arrival: new Date() })
          .where(eq(routeStops.id, stop_id));
      });
    } else {
      // No linked shipment found, just complete the stop
      await db
        .update(routeStops)
        .set({ status: 'completed', actual_arrival: new Date() })
        .where(eq(routeStops.id, stop_id));
    }
  } else {
    // Non-delivery stop or no shipment linked
    await db
      .update(routeStops)
      .set({ status: 'completed', actual_arrival: new Date() })
      .where(eq(routeStops.id, stop_id));
  }

  // Fetch updated stop
  const [updatedStop] = await db
    .select({
      id: routeStops.id,
      shipment_id: routeStops.shipment_id,
      stop_type: routeStops.stop_type,
      sequence_order: routeStops.sequence_order,
      lat: sql<number | null>`CASE WHEN ${routeStops.location} IS NOT NULL THEN ST_Y(${routeStops.location}::geometry) ELSE NULL END`,
      lng: sql<number | null>`CASE WHEN ${routeStops.location} IS NOT NULL THEN ST_X(${routeStops.location}::geometry) ELSE NULL END`,
      address: routeStops.address,
      planned_arrival: routeStops.planned_arrival,
      actual_arrival: routeStops.actual_arrival,
      status: routeStops.status,
    })
    .from(routeStops)
    .where(eq(routeStops.id, stop_id))
    .limit(1);

  return {
    error: null,
    data: {
      id: updatedStop.id,
      shipment_id: updatedStop.shipment_id,
      stop_type: updatedStop.stop_type,
      sequence_order: updatedStop.sequence_order,
      location:
        updatedStop.lat != null && updatedStop.lng != null
          ? { lat: Number(updatedStop.lat), lng: Number(updatedStop.lng) }
          : { lat: 0, lng: 0 },
      address: updatedStop.address ?? '',
      planned_arrival: updatedStop.planned_arrival?.toISOString() ?? null,
      actual_arrival: updatedStop.actual_arrival?.toISOString() ?? null,
      status: updatedStop.status ?? 'completed',
    },
  };
}

async function formatRouteWithStops(route: typeof routes.$inferSelect, stops: any[]) {
  // Re-fetch stops with coordinates extracted from PostGIS geometry
  let stopsWithCoords = stops;
  if (stops.length > 0) {
    const stopIds = stops.map((s) => s.id);
    stopsWithCoords = await db
      .select({
        id: routeStops.id,
        shipment_id: routeStops.shipment_id,
        stop_type: routeStops.stop_type,
        sequence_order: routeStops.sequence_order,
        lat: sql<number | null>`CASE WHEN ${routeStops.location} IS NOT NULL THEN ST_Y(${routeStops.location}::geometry) ELSE NULL END`,
        lng: sql<number | null>`CASE WHEN ${routeStops.location} IS NOT NULL THEN ST_X(${routeStops.location}::geometry) ELSE NULL END`,
        address: routeStops.address,
        planned_arrival: routeStops.planned_arrival,
        actual_arrival: routeStops.actual_arrival,
        status: routeStops.status,
      })
      .from(routeStops)
      .where(sql`${routeStops.id} IN (${sql.join(stopIds.map((id: string) => sql`${id}`), sql`, `)})`)
      .orderBy(asc(routeStops.sequence_order));
  }

  return {
    id: route.id,
    name: route.name,
    status: route.status,
    vehicle_id: route.vehicle_id,
    driver_id: route.driver_id,
    planned_date: route.planned_date ?? '',
    estimated_distance_km: route.estimated_distance_km != null ? Number(route.estimated_distance_km) : null,
    optimization_score: route.optimization_score != null ? Number(route.optimization_score) : null,
    stops: stopsWithCoords.map((s: any) => ({
      id: s.id,
      shipment_id: s.shipment_id,
      stop_type: s.stop_type,
      sequence_order: s.sequence_order,
      location:
        s.lat != null && s.lng != null
          ? { lat: Number(s.lat), lng: Number(s.lng) }
          : { lat: 0, lng: 0 },
      address: s.address ?? '',
      planned_arrival: s.planned_arrival?.toISOString() ?? null,
      actual_arrival: s.actual_arrival?.toISOString() ?? null,
      status: s.status ?? 'pending',
    })),
    created_at: route.created_at?.toISOString() ?? '',
    updated_at: route.updated_at?.toISOString() ?? '',
  };
}
