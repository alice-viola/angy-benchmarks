import { Worker, type Job } from 'bullmq';
import { db, sql } from '../db/connection.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/**
 * Maintenance Worker
 *
 * Handles periodic maintenance tasks:
 * - driving-hours-reset: Resets all drivers' current_driving_hours to 0 (nightly cron)
 */
export function createMaintenanceWorker() {
  const worker = new Worker(
    'maintenance',
    async (job: Job) => {
      switch (job.name) {
        case 'driving-hours-reset': {
          // Reset all drivers' current_driving_hours to 0
          const result = await sql`
            UPDATE drivers
            SET current_driving_hours = 0,
                updated_at = NOW()
            WHERE is_active = true
              AND current_driving_hours > 0
          `;

          console.log(`[maintenance] Reset driving hours for drivers`);

          return { reset: true };
        }

        default:
          console.warn(`[maintenance] Unknown job name: ${job.name}`);
          return { skipped: true };
      }
    },
    {
      connection: {
        url: REDIS_URL,
      },
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[maintenance] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  return worker;
}
