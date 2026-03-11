import type { Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { redis } from '../lib/redis.js';

export async function processLocationFlush(_job: Job): Promise<void> {
  // Scan for dirty_vehicles:* keys
  let cursor = '0';
  const dirtyKeys: string[] = [];

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'dirty_vehicles:*', 'COUNT', 100);
    cursor = nextCursor;
    dirtyKeys.push(...keys);
  } while (cursor !== '0');

  for (const key of dirtyKeys) {
    const tenantId = key.replace('dirty_vehicles:', '');

    // Get all dirty vehicle IDs
    const vehicleIds = await redis.zrange(key, 0, -1);
    if (!vehicleIds.length) continue;

    // Collect all location data for batch update
    const updates: { vehicleId: string; lng: number; lat: number; timestamp: Date; speedKmh: string; heading: string }[] = [];

    for (const vehicleId of vehicleIds) {
      const data = await redis.hgetall(`vehicle_location:${vehicleId}`);
      if (!data.lat || !data.lng || !data.tenant_id) continue;

      // Verify tenant isolation
      if (data.tenant_id !== tenantId) continue;

      updates.push({
        vehicleId,
        lng: Number(data.lng),
        lat: Number(data.lat),
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        speedKmh: data.speed_kmh || '0',
        heading: data.heading || '0',
      });
    }

    if (!updates.length) continue;

    // Batch UPDATE using a single query with unnest arrays
    try {
      const ids = updates.map((u) => u.vehicleId);
      const lngs = updates.map((u) => u.lng);
      const lats = updates.map((u) => u.lat);
      const timestamps = updates.map((u) => u.timestamp.toISOString());
      const speeds = updates.map((u) => u.speedKmh);
      const headings = updates.map((u) => u.heading);

      await db.execute(
        sql`UPDATE vehicles AS v
            SET last_location = ST_SetSRID(ST_MakePoint(batch.lng, batch.lat), 4326),
                last_location_at = batch.ts::timestamptz,
                last_speed_kmh = batch.speed::numeric,
                heading = batch.hdg::numeric,
                updated_at = NOW()
            FROM (
              SELECT unnest(${ids}::uuid[]) AS id,
                     unnest(${lngs}::double precision[]) AS lng,
                     unnest(${lats}::double precision[]) AS lat,
                     unnest(${timestamps}::text[]) AS ts,
                     unnest(${speeds}::text[]) AS speed,
                     unnest(${headings}::text[]) AS hdg
            ) AS batch
            WHERE v.id = batch.id AND v.tenant_id = ${tenantId}`,
      );

      // Remove all processed entries
      await redis.zrem(key, ...ids);
    } catch {
      // Leave intact for next cycle on failure
    }
  }
}
