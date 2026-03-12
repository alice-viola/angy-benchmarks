import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicles } from '../db/schema.js';
import { QUEUE_NAMES } from './queue-setup.js';

interface LocationFlushJobData {
  tenantId: string;
}

interface VehicleLocationData {
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  ts: string;
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    redis = new Redis(url, { maxRetriesPerRequest: null });
  }
  return redis;
}

export async function processLocationFlush(job: Job<LocationFlushJobData>) {
  const { tenantId } = job.data;
  const r = getRedis();
  const dirtySetKey = `dirty_vehicles:${tenantId}`;

  // Step 1: Read all vehicleIds with score <= now from the sorted set
  const now = Date.now();
  const vehicleIds = await r.zrangebyscore(dirtySetKey, '-inf', now);

  if (vehicleIds.length === 0) {
    return { flushed: 0 };
  }

  // Step 2: For each vehicleId, fetch the latest location from the Redis hash
  const locations: VehicleLocationData[] = [];

  for (const vehicleId of vehicleIds) {
    const hashData = await r.hgetall(`vehicle_location:${vehicleId}`);
    if (!hashData || !hashData.lat || !hashData.lng) {
      continue;
    }

    locations.push({
      vehicleId,
      lat: parseFloat(hashData.lat),
      lng: parseFloat(hashData.lng),
      speed: parseFloat(hashData.speed ?? '0'),
      heading: parseFloat(hashData.heading ?? '0'),
      ts: hashData.ts ?? new Date().toISOString(),
    });
  }

  if (locations.length === 0) {
    // Vehicle IDs were dirty but no location data found — clean them up
    await r.zrem(dirtySetKey, ...vehicleIds);
    return { flushed: 0 };
  }

  // Step 3: Batch-upsert locations into the vehicles table
  for (const loc of locations) {
    await db
      .update(vehicles)
      .set({
        last_location: sql`ST_SetSRID(ST_MakePoint(${loc.lng}, ${loc.lat}), 4326)`,
        last_location_at: new Date(loc.ts),
        last_speed_kmh: String(loc.speed),
        heading: String(loc.heading),
        updated_at: new Date(),
      })
      .where(sql`${vehicles.id} = ${loc.vehicleId}`);
  }

  // Step 4: Remove successfully flushed vehicleIds from the sorted set
  const flushedIds = locations.map((l) => l.vehicleId);
  await r.zrem(dirtySetKey, ...flushedIds);

  return { flushed: locations.length };
}

export function createLocationFlushWorker() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker(QUEUE_NAMES.LOCATION_FLUSH, processLocationFlush, {
    connection: connection as any,
    concurrency: 5,
  });
}
