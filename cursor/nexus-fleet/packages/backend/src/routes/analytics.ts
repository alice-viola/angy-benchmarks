import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql, count, gte, lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles, drivers, shipments } from '../db/schema.js';

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // GET /overview – vehicle/driver/shipment counts by status
  fastify.get('/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;

    const [vehicleStats, driverStats, shipmentStats] = await Promise.all([
      db
        .select({
          status: vehicles.status,
          count: count(),
        })
        .from(vehicles)
        .where(and(eq(vehicles.tenantId, tenantId), eq(vehicles.isActive, true)))
        .groupBy(vehicles.status),

      db
        .select({
          status: drivers.status,
          count: count(),
        })
        .from(drivers)
        .where(and(eq(drivers.tenantId, tenantId), eq(drivers.isActive, true)))
        .groupBy(drivers.status),

      db
        .select({
          status: shipments.status,
          count: count(),
        })
        .from(shipments)
        .where(eq(shipments.tenantId, tenantId))
        .groupBy(shipments.status),
    ]);

    const toMap = (rows: { status: string; count: number }[]) =>
      Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));

    return reply.send({
      success: true,
      data: {
        vehicles: {
          byStatus: toMap(vehicleStats),
          total: vehicleStats.reduce((s, r) => s + Number(r.count), 0),
        },
        drivers: {
          byStatus: toMap(driverStats),
          total: driverStats.reduce((s, r) => s + Number(r.count), 0),
        },
        shipments: {
          byStatus: toMap(shipmentStats),
          total: shipmentStats.reduce((s, r) => s + Number(r.count), 0),
        },
      },
    });
  });

  // GET /shipments – shipment stats over time range
  fastify.get('/shipments', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user!;
    const { start_date, end_date } = request.query as {
      start_date?: string;
      end_date?: string;
    };

    const conditions = [eq(shipments.tenantId, tenantId)];

    if (start_date) {
      conditions.push(gte(shipments.createdAt, new Date(start_date)));
    }
    if (end_date) {
      conditions.push(lte(shipments.createdAt, new Date(end_date)));
    }

    const where = and(...conditions);

    const [statusBreakdown, dailyVolume, priorityBreakdown] = await Promise.all([
      db
        .select({
          status: shipments.status,
          count: count(),
        })
        .from(shipments)
        .where(where)
        .groupBy(shipments.status),

      db.execute(sql`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS count
        FROM shipments
        WHERE tenant_id = ${tenantId}
          ${start_date ? sql`AND created_at >= ${start_date}` : sql``}
          ${end_date ? sql`AND created_at <= ${end_date}` : sql``}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),

      db
        .select({
          priority: shipments.priority,
          count: count(),
        })
        .from(shipments)
        .where(where)
        .groupBy(shipments.priority),
    ]);

    const dailyRows = dailyVolume.rows ?? dailyVolume;

    return reply.send({
      success: true,
      data: {
        byStatus: Object.fromEntries(statusBreakdown.map((r) => [r.status, Number(r.count)])),
        byPriority: Object.fromEntries(priorityBreakdown.map((r) => [r.priority, Number(r.count)])),
        dailyVolume: (dailyRows as any[]).map((r: any) => ({
          date: r.date,
          count: Number(r.count),
        })),
        total: statusBreakdown.reduce((s, r) => s + Number(r.count), 0),
      },
    });
  });
}
