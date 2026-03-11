import { eq, and, count, sql, gte, lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles, drivers, shipments } from '../db/schema.js';
import { ServiceError } from './vehicle.service.js';

export async function overview(tenantId: string) {
  const [vehicleCounts] = await db
    .select({
      total: count(),
      available: count(sql`CASE WHEN ${vehicles.status} = 'available' THEN 1 END`),
      in_transit: count(sql`CASE WHEN ${vehicles.status} = 'in_transit' THEN 1 END`),
      maintenance: count(sql`CASE WHEN ${vehicles.status} = 'maintenance' THEN 1 END`),
    })
    .from(vehicles)
    .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.is_active, true)));

  const [driverCounts] = await db
    .select({
      total: count(),
      available: count(sql`CASE WHEN ${drivers.status} = 'available' THEN 1 END`),
      driving: count(sql`CASE WHEN ${drivers.status} = 'driving' THEN 1 END`),
      off_duty: count(sql`CASE WHEN ${drivers.status} = 'off_duty' THEN 1 END`),
    })
    .from(drivers)
    .where(and(eq(drivers.tenant_id, tenantId), eq(drivers.is_active, true)));

  const [shipmentCounts] = await db
    .select({
      total: count(),
      draft: count(sql`CASE WHEN ${shipments.status} = 'draft' THEN 1 END`),
      confirmed: count(sql`CASE WHEN ${shipments.status} = 'confirmed' THEN 1 END`),
      assigned: count(sql`CASE WHEN ${shipments.status} = 'assigned' THEN 1 END`),
      picked_up: count(sql`CASE WHEN ${shipments.status} = 'picked_up' THEN 1 END`),
      in_transit: count(sql`CASE WHEN ${shipments.status} = 'in_transit' THEN 1 END`),
      delivered: count(sql`CASE WHEN ${shipments.status} = 'delivered' THEN 1 END`),
      completed: count(sql`CASE WHEN ${shipments.status} = 'completed' THEN 1 END`),
      failed: count(sql`CASE WHEN ${shipments.status} = 'failed' THEN 1 END`),
      cancelled: count(sql`CASE WHEN ${shipments.status} = 'cancelled' THEN 1 END`),
    })
    .from(shipments)
    .where(eq(shipments.tenant_id, tenantId));

  // Delivered today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [{ count: deliveredToday }] = await db
    .select({ count: count() })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenant_id, tenantId),
        eq(shipments.status, 'delivered'),
        gte(shipments.actual_delivery_at, todayStart),
        lte(shipments.actual_delivery_at, todayEnd),
      ),
    );

  return {
    vehicles: vehicleCounts,
    drivers: driverCounts,
    shipments: { ...shipmentCounts, delivered_today: deliveredToday },
  };
}

export async function shipmentsByDateRange(tenantId: string, from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Max 365 days
  const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 365) {
    throw new ServiceError('Date range cannot exceed 365 days', 400, 'INVALID_RANGE');
  }

  const result = await db.execute(sql`
    SELECT
      DATE(actual_delivery_at) as date,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed
    FROM shipments
    WHERE tenant_id = ${tenantId}
      AND actual_delivery_at >= ${fromDate}
      AND actual_delivery_at <= ${toDate}
    GROUP BY DATE(actual_delivery_at)
    ORDER BY date ASC
  `);

  return result;
}
