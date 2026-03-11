import type { Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { redis } from '../lib/redis.js';

export async function processMaintenance(job: Job): Promise<void> {
  if (job.name === 'driving-hours-reset') {
    // Reset driving hours for all active drivers
    await db.execute(
      sql`UPDATE drivers SET current_driving_hours = 0, updated_at = NOW() WHERE is_active = true`,
    );

    // Scan and DEL stale driving_start:* Redis keys
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'driving_start:*', 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
