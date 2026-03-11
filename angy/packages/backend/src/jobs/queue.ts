import { Queue, Worker } from 'bullmq';
import { env } from '../env.js';

const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: Number(new URL(env.REDIS_URL).port) || 6379,
};

// ── Queues ────────────────────────────────────────────────────────────────────

export const locationFlushQueue = new Queue('location-flush', { connection });
export const routeOptimizationQueue = new Queue('route-optimization', { connection });
export const webhooksQueue = new Queue('webhooks', { connection });
export const maintenanceQueue = new Queue('maintenance', { connection });

// ── Register repeatable jobs ──────────────────────────────────────────────────

async function registerRepeatableJobs(): Promise<void> {
  await locationFlushQueue.add(
    'flush-locations',
    {},
    { repeat: { every: 5000 }, removeOnComplete: true, removeOnFail: 100 },
  );

  await maintenanceQueue.add(
    'driving-hours-reset',
    {},
    { repeat: { pattern: '0 0 * * *', tz: 'UTC' }, removeOnComplete: true, removeOnFail: 10 },
  );
}

// ── Worker starters ───────────────────────────────────────────────────────────

export async function startWorkers(): Promise<Worker[]> {
  await registerRepeatableJobs();

  const { processLocationFlush } = await import('./location-flush.job.js');
  const { processRouteOptimization } = await import('./route-optimization.job.js');
  const { processWebhookDelivery } = await import('./webhook-delivery.job.js');
  const { processMaintenance } = await import('./maintenance.job.js');

  const locationFlushWorker = new Worker('location-flush', processLocationFlush, {
    connection,
    concurrency: 1,
  });

  const routeOptimizationWorker = new Worker('route-optimization', processRouteOptimization, {
    connection,
    concurrency: 2,
  });

  const webhooksWorker = new Worker('webhooks', processWebhookDelivery, {
    connection,
    concurrency: 5,
  });

  const maintenanceWorker = new Worker('maintenance', processMaintenance, {
    connection,
    concurrency: 1,
  });

  return [locationFlushWorker, routeOptimizationWorker, webhooksWorker, maintenanceWorker];
}
