import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { drivers } from '../db/schema.js';
import { QUEUE_NAMES, getQueue } from './queue-setup.js';

export async function processDrivingHoursReset(_job: Job) {
  const result = await db
    .update(drivers)
    .set({
      current_driving_hours: '0',
      updated_at: new Date(),
    })
    .where(sql`${drivers.current_driving_hours}::numeric > 0`)
    .returning({ id: drivers.id });

  return { reset_count: result.length };
}

export async function scheduleDrivingHoursReset() {
  const queue = getQueue(QUEUE_NAMES.DRIVING_HOURS_RESET);
  await queue.add('reset', {}, { repeat: { pattern: '0 0 * * *' } });
}

export function createDrivingHoursResetWorker() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker(QUEUE_NAMES.DRIVING_HOURS_RESET, processDrivingHoursReset, {
    connection: connection as any,
    concurrency: 1,
  });
}
