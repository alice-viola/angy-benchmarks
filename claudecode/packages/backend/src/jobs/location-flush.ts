import { Worker, type Job } from 'bullmq';
import { redis, sql } from '../db/connection.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/**
 * Location Flush Worker
 *
 * Repeatable every 5 seconds. Reads all dirty vehicle IDs from Redis,
 * fetches their locations from Redis hashes, and batch updates the
 * vehicles table using raw SQL with PostGIS.
 */
export function createLocationFlushWorker() {
  const worker = new Worker(
    'location-flush',
    async (job: Job) => {
      // Get all tenant dirty sets
      const tenantKeys = await redis.keys('dirty_vehicles:*');

      for (const tenantKey of tenantKeys) {
        const tenantId = tenantKey.replace('dirty_vehicles:', '');

        // Get all dirty vehicle IDs
        const vehicleIds = await redis.smembers(tenantKey);
        if (vehicleIds.length === 0) continue;

        // Fetch locations from Redis
        const updates: Array<{
          id: string;
          lat: number;
          lng: number;
          speed_kmh: number;
          heading: number;
          timestamp: string;
        }> = [];

        for (const vehicleId of vehicleIds) {
          const data = await redis.hgetall(`vehicle_location:${vehicleId}`);
          if (data && data.lat && data.lng) {
            updates.push({
              id: vehicleId,
              lat: parseFloat(data.lat),
              lng: parseFloat(data.lng),
              speed_kmh: parseFloat(data.speed_kmh ?? '0'),
              heading: parseFloat(data.heading ?? '0'),
              timestamp: data.timestamp ?? new Date().toISOString(),
            });
          }
        }

        if (updates.length === 0) {
          await redis.del(tenantKey);
          continue;
        }

        // Batch update using raw SQL
        // Uses PostGIS ST_SetSRID(ST_MakePoint(lng, lat), 4326) for geometry column
        for (const update of updates) {
          try {
            await sql`
              UPDATE vehicles
              SET
                last_location = ST_SetSRID(ST_MakePoint(${update.lng}, ${update.lat}), 4326)::text,
                last_location_lat = ${update.lat},
                last_location_lng = ${update.lng},
                last_speed_kmh = ${update.speed_kmh},
                last_heading = ${update.heading},
                last_location_at = ${update.timestamp}::timestamptz,
                updated_at = NOW()
              WHERE id = ${update.id}
                AND tenant_id = ${tenantId}
            `;
          } catch (err) {
            // If PostGIS is not available, fall back to just updating lat/lng
            await sql`
              UPDATE vehicles
              SET
                last_location_lat = ${update.lat},
                last_location_lng = ${update.lng},
                last_speed_kmh = ${update.speed_kmh},
                last_heading = ${update.heading},
                last_location_at = ${update.timestamp}::timestamptz,
                updated_at = NOW()
              WHERE id = ${update.id}
                AND tenant_id = ${tenantId}
            `;
          }
        }

        // Clear dirty set entries that we processed
        await redis.srem(tenantKey, ...vehicleIds);
      }

      return { flushed: true };
    },
    {
      connection: {
        url: REDIS_URL,
      },
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[location-flush] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
