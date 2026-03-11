import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { processLocationFlush } from './location-flush.js';
import { processRouteOptimization } from './route-optimization.js';
import { processWebhookDelivery } from './webhook-delivery.js';
import { processDrivingHoursReset } from './maintenance.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

export const locationFlushQueue = new Queue('location-flush', { connection });
export const routeOptimizationQueue = new Queue('route-optimization', { connection });
export const webhookQueue = new Queue('webhooks', { connection });
export const maintenanceQueue = new Queue('maintenance', { connection });

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

export function startWorkers() {
  const locationFlushWorker = new Worker(
    'location-flush',
    async (job) => processLocationFlush(job),
    { connection, concurrency: 1 },
  );

  const routeOptimizationWorker = new Worker(
    'route-optimization',
    async (job) => processRouteOptimization(job),
    { connection, concurrency: 2 },
  );

  const webhookWorker = new Worker(
    'webhooks',
    async (job) => processWebhookDelivery(job),
    {
      connection,
      concurrency: 5,
      limiter: { max: 50, duration: 1000 },
    },
  );

  const maintenanceWorker = new Worker(
    'maintenance',
    async (job) => {
      switch (job.name) {
        case 'driving-hours-reset':
          return processDrivingHoursReset(job);
        default:
          throw new Error(`Unknown maintenance job: ${job.name}`);
      }
    },
    { connection, concurrency: 1 },
  );

  const workers = [locationFlushWorker, routeOptimizationWorker, webhookWorker, maintenanceWorker];

  for (const w of workers) {
    w.on('failed', (job, err) => {
      console.error(`[${w.name}] Job ${job?.id} failed:`, err.message);
    });
    w.on('completed', (job) => {
      console.log(`[${w.name}] Job ${job.id} completed`);
    });
  }

  return workers;
}

// ---------------------------------------------------------------------------
// Repeatable (cron) jobs
// ---------------------------------------------------------------------------

export async function registerRepeatableJobs() {
  // Flush vehicle locations from Redis to DB every 5 seconds
  await locationFlushQueue.add(
    'flush-locations',
    {},
    {
      repeat: { every: 5_000 },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    },
  );

  // Reset driving hours daily at midnight UTC
  await maintenanceQueue.add(
    'driving-hours-reset',
    {},
    {
      repeat: { pattern: '0 0 * * *' },
      removeOnComplete: { count: 5 },
      removeOnFail: { count: 10 },
    },
  );
}
