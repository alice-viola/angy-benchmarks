import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles, drivers, shipments, routes } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export async function analyticsRoutes(app: FastifyInstance) {
  // GET /api/v1/analytics/overview
  app.get('/overview', async (request) => {
    const tenant_id = request.user.tenant_id;

    const [vehicleStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        available: sql<number>`count(*) filter (where ${vehicles.status} = 'available')::int`,
        in_transit: sql<number>`count(*) filter (where ${vehicles.status} = 'in_transit')::int`,
        maintenance: sql<number>`count(*) filter (where ${vehicles.status} = 'maintenance')::int`,
      })
      .from(vehicles)
      .where(and(eq(vehicles.tenant_id, tenant_id), eq(vehicles.is_active, true)));

    const [driverStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        available: sql<number>`count(*) filter (where ${drivers.status} = 'available')::int`,
        driving: sql<number>`count(*) filter (where ${drivers.status} = 'driving')::int`,
        off_duty: sql<number>`count(*) filter (where ${drivers.status} = 'off_duty')::int`,
      })
      .from(drivers)
      .where(and(eq(drivers.tenant_id, tenant_id), eq(drivers.is_active, true)));

    const [shipmentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        in_transit: sql<number>`count(*) filter (where ${shipments.status} = 'in_transit')::int`,
        delivered: sql<number>`count(*) filter (where ${shipments.status} = 'delivered')::int`,
        completed: sql<number>`count(*) filter (where ${shipments.status} = 'completed')::int`,
        failed: sql<number>`count(*) filter (where ${shipments.status} = 'failed')::int`,
      })
      .from(shipments)
      .where(eq(shipments.tenant_id, tenant_id));

    const [routeStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${routes.status} = 'active')::int`,
      })
      .from(routes)
      .where(eq(routes.tenant_id, tenant_id));

    return {
      success: true,
      data: {
        vehicles: vehicleStats,
        drivers: driverStats,
        shipments: shipmentStats,
        routes: routeStats,
      },
    };
  });
}
