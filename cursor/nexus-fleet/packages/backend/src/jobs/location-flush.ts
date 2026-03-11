import type { Job } from 'bullmq';
import Redis from 'ioredis';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export async function processLocationFlush(_job: Job) {
  // Read all dirty vehicle IDs from the sorted set
  const dirtyEntries = await redis.zrangebyscore('dirty-vehicles', '-inf', '+inf');

  if (dirtyEntries.length === 0) {
    return { flushed: 0 };
  }

  const pipeline = redis.pipeline();
  for (const vehicleId of dirtyEntries) {
    pipeline.hgetall(`vehicle:${vehicleId}:location`);
  }
  const results = await pipeline.exec();

  if (!results) {
    return { flushed: 0 };
  }

  let flushed = 0;

  for (let i = 0; i < dirtyEntries.length; i++) {
    const vehicleId = dirtyEntries[i];
    const [err, data] = results[i] as [Error | null, Record<string, string> | null];
    if (err || !data || !data.lat || !data.lng) continue;

    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    const speed = parseFloat(data.speed || '0');
    const heading = parseFloat(data.heading || '0');
    const timestamp = data.timestamp;

    await db.execute(sql`
      UPDATE vehicles
      SET
        last_location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        last_location_at = ${timestamp}::timestamptz,
        speed_kmh = ${speed},
        heading = ${heading},
        updated_at = NOW()
      WHERE id = ${vehicleId}::uuid
    `);

    flushed++;
  }

  // Clear processed entries from dirty set
  if (dirtyEntries.length > 0) {
    await redis.zrem('dirty-vehicles', ...dirtyEntries);
  }

  return { flushed, total: dirtyEntries.length };
}
