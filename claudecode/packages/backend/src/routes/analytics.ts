import type { FastifyPluginAsync } from 'fastify';
import { eq, and, sql, gte, lte, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles, drivers, shipments } from '../db/schema.js';

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET /overview - Dashboard summary stats
  // -------------------------------------------------------------------------
  fastify.get('/overview', async (request, reply) => {
    const tenantId = request.tenantId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      vehiclesByStatus,
      driversByStatus,
      activeShipments,
      deliveredToday,
    ] = await Promise.all([
      // Vehicles by status
      db
        .select({
          status: vehicles.status,
          count: count(),
        })
        .from(vehicles)
        .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.is_active, true)))
        .groupBy(vehicles.status),

      // Drivers by status
      db
        .select({
          status: drivers.status,
          count: count(),
        })
        .from(drivers)
        .where(and(eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)))
        .groupBy(drivers.status),

      // Active shipments (not draft, completed, cancelled, or failed)
      db
        .select({ count: count() })
        .from(shipments)
        .where(
          and(
            eq(shipments.tenant_id, tenantId),
            eq(shipments.is_deleted, false),
            sql`${shipments.status} IN ('confirmed', 'assigned', 'picked_up', 'in_transit')`,
          ),
        ),

      // Delivered today
      db
        .select({ count: count() })
        .from(shipments)
        .where(
          and(
            eq(shipments.tenant_id, tenantId),
            eq(shipments.status, 'delivered'),
            gte(shipments.actual_delivery_at, todayStart),
            lte(shipments.actual_delivery_at, todayEnd),
          ),
        ),
    ]);

    return reply.send({
      success: true,
      data: {
        vehicles: {
          byStatus: vehiclesByStatus.reduce(
            (acc, row) => ({ ...acc, [row.status]: row.count }),
            {} as Record<string, number>,
          ),
        },
        drivers: {
          byStatus: driversByStatus.reduce(
            (acc, row) => ({ ...acc, [row.status]: row.count }),
            {} as Record<string, number>,
          ),
        },
        shipments: {
          active: activeShipments[0]?.count ?? 0,
          deliveredToday: deliveredToday[0]?.count ?? 0,
        },
      },
    });
  });

  // -------------------------------------------------------------------------
  // GET /shipments - Shipment stats over time range
  // -------------------------------------------------------------------------
  fastify.get('/shipments', async (request, reply) => {
    const tenantId = request.tenantId;
    const query = request.query as Record<string, string>;

    const startDate = query.start ? new Date(query.start) : new Date(Date.now() - 30 * 86400000);
    const endDate = query.end ? new Date(query.end) : new Date();

    const [byStatus, byPriority, byDate] = await Promise.all([
      // Count by status
      db
        .select({
          status: shipments.status,
          count: count(),
        })
        .from(shipments)
        .where(
          and(
            eq(shipments.tenant_id, tenantId),
            eq(shipments.is_deleted, false),
            gte(shipments.created_at, startDate),
            lte(shipments.created_at, endDate),
          ),
        )
        .groupBy(shipments.status),

      // Count by priority
      db
        .select({
          priority: shipments.priority,
          count: count(),
        })
        .from(shipments)
        .where(
          and(
            eq(shipments.tenant_id, tenantId),
            eq(shipments.is_deleted, false),
            gte(shipments.created_at, startDate),
            lte(shipments.created_at, endDate),
          ),
        )
        .groupBy(shipments.priority),

      // Count by date (grouped by day)
      db
        .select({
          date: sql<string>`DATE(${shipments.created_at})`.as('date'),
          count: count(),
        })
        .from(shipments)
        .where(
          and(
            eq(shipments.tenant_id, tenantId),
            eq(shipments.is_deleted, false),
            gte(shipments.created_at, startDate),
            lte(shipments.created_at, endDate),
          ),
        )
        .groupBy(sql`DATE(${shipments.created_at})`)
        .orderBy(sql`DATE(${shipments.created_at})`),
    ]);

    return reply.send({
      success: true,
      data: {
        byStatus: byStatus.reduce(
          (acc, row) => ({ ...acc, [row.status]: row.count }),
          {} as Record<string, number>,
        ),
        byPriority: byPriority.reduce(
          (acc, row) => ({ ...acc, [row.priority]: row.count }),
          {} as Record<string, number>,
        ),
        byDate,
        range: { start: startDate.toISOString(), end: endDate.toISOString() },
      },
    });
  });
};
