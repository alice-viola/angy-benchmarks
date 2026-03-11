import { eq, and, sql, between, count } from 'drizzle-orm';
import type { Database } from '../db/connection.js';
import * as schema from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusCount {
  status: string;
  count: number;
}

export interface OverviewStats {
  vehicles: {
    total: number;
    byStatus: StatusCount[];
  };
  drivers: {
    total: number;
    byStatus: StatusCount[];
  };
  shipments: {
    active: number;
    delivered: number;
    total: number;
  };
}

export interface ShipmentStatsRow {
  date: string;
  created: number;
  delivered: number;
  failed: number;
  cancelled: number;
}

export interface ShipmentStats {
  rows: ShipmentStatsRow[];
  totals: {
    created: number;
    delivered: number;
    failed: number;
    cancelled: number;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AnalyticsService {
  constructor(private db: Database) {}

  async getOverview(tenantId: string): Promise<OverviewStats> {
    const [vehiclesByStatus, driversByStatus, shipmentCounts] = await Promise.all([
      this.db
        .select({
          status: schema.vehicles.status,
          count: count(),
        })
        .from(schema.vehicles)
        .where(
          and(eq(schema.vehicles.tenantId, tenantId), eq(schema.vehicles.isActive, true)),
        )
        .groupBy(schema.vehicles.status),

      this.db
        .select({
          status: schema.drivers.status,
          count: count(),
        })
        .from(schema.drivers)
        .where(
          and(eq(schema.drivers.tenantId, tenantId), eq(schema.drivers.isActive, true)),
        )
        .groupBy(schema.drivers.status),

      this.db
        .select({
          status: schema.shipments.status,
          count: count(),
        })
        .from(schema.shipments)
        .where(eq(schema.shipments.tenantId, tenantId))
        .groupBy(schema.shipments.status),
    ]);

    const vehicleTotal = vehiclesByStatus.reduce((sum, v) => sum + Number(v.count), 0);
    const driverTotal = driversByStatus.reduce((sum, d) => sum + Number(d.count), 0);

    const shipmentMap = new Map(shipmentCounts.map((s) => [s.status, Number(s.count)]));
    const activeStatuses = ['confirmed', 'assigned', 'picked_up', 'in_transit'];
    const activeCount = activeStatuses.reduce((sum, st) => sum + (shipmentMap.get(st) ?? 0), 0);
    const deliveredCount = (shipmentMap.get('delivered') ?? 0) + (shipmentMap.get('completed') ?? 0);
    const shipmentTotal = shipmentCounts.reduce((sum, s) => sum + Number(s.count), 0);

    return {
      vehicles: {
        total: vehicleTotal,
        byStatus: vehiclesByStatus.map((v) => ({ status: v.status, count: Number(v.count) })),
      },
      drivers: {
        total: driverTotal,
        byStatus: driversByStatus.map((d) => ({ status: d.status, count: Number(d.count) })),
      },
      shipments: {
        active: activeCount,
        delivered: deliveredCount,
        total: shipmentTotal,
      },
    };
  }

  async getShipmentStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ShipmentStats> {
    const rows = await this.db.execute<ShipmentStatsRow>(sql`
      SELECT
        d.date::text AS date,
        COALESCE(created.cnt, 0)::int   AS created,
        COALESCE(delivered.cnt, 0)::int  AS delivered,
        COALESCE(failed.cnt, 0)::int     AS failed,
        COALESCE(cancelled.cnt, 0)::int  AS cancelled
      FROM generate_series(
        ${startDate.toISOString()}::date,
        ${endDate.toISOString()}::date,
        '1 day'::interval
      ) AS d(date)
      LEFT JOIN (
        SELECT created_at::date AS day, count(*) AS cnt
        FROM shipments
        WHERE tenant_id = ${tenantId}
          AND created_at >= ${startDate.toISOString()}
          AND created_at < ${endDate.toISOString()}::date + interval '1 day'
        GROUP BY day
      ) AS created ON created.day = d.date
      LEFT JOIN (
        SELECT actual_delivery::date AS day, count(*) AS cnt
        FROM shipments
        WHERE tenant_id = ${tenantId}
          AND status IN ('delivered', 'completed')
          AND actual_delivery >= ${startDate.toISOString()}
          AND actual_delivery < ${endDate.toISOString()}::date + interval '1 day'
        GROUP BY day
      ) AS delivered ON delivered.day = d.date
      LEFT JOIN (
        SELECT updated_at::date AS day, count(*) AS cnt
        FROM shipments
        WHERE tenant_id = ${tenantId}
          AND status = 'failed'
          AND updated_at >= ${startDate.toISOString()}
          AND updated_at < ${endDate.toISOString()}::date + interval '1 day'
        GROUP BY day
      ) AS failed ON failed.day = d.date
      LEFT JOIN (
        SELECT updated_at::date AS day, count(*) AS cnt
        FROM shipments
        WHERE tenant_id = ${tenantId}
          AND status = 'cancelled'
          AND updated_at >= ${startDate.toISOString()}
          AND updated_at < ${endDate.toISOString()}::date + interval '1 day'
        GROUP BY day
      ) AS cancelled ON cancelled.day = d.date
      ORDER BY d.date
    `);

    const resultRows: ShipmentStatsRow[] = (rows as unknown as ShipmentStatsRow[]).map((r) => ({
      date: String(r.date),
      created: Number(r.created),
      delivered: Number(r.delivered),
      failed: Number(r.failed),
      cancelled: Number(r.cancelled),
    }));

    const totals = resultRows.reduce(
      (acc, r) => {
        acc.created += r.created;
        acc.delivered += r.delivered;
        acc.failed += r.failed;
        acc.cancelled += r.cancelled;
        return acc;
      },
      { created: 0, delivered: 0, failed: 0, cancelled: 0 },
    );

    return { rows: resultRows, totals };
  }
}
