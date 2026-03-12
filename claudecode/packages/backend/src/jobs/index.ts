import { Queue } from 'bullmq';
import { createLocationFlushWorker } from './location-flush.js';
import { createRouteOptimizationWorker } from './route-optimization.js';
import { createWebhookWorker } from './webhooks.js';
import { createMaintenanceWorker } from './maintenance.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const connectionOpts = {
  url: REDIS_URL,
};

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

export const locationFlushQueue = new Queue('location-flush', {
  connection: connectionOpts,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const routeOptimizationQueue = new Queue('route-optimization', {
  connection: connectionOpts,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const webhookQueue = new Queue('webhooks', {
  connection: connectionOpts,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 500,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const maintenanceQueue = new Queue('maintenance', {
  connection: connectionOpts,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

// ---------------------------------------------------------------------------
// Initialize all workers and repeatable jobs
// ---------------------------------------------------------------------------

let initialized = false;

export function initializeJobs() {
  if (initialized) return;
  initialized = true;

  console.log('[jobs] Initializing BullMQ workers and repeatable jobs...');

  // Create workers
  createLocationFlushWorker();
  createRouteOptimizationWorker();
  createWebhookWorker();
  createMaintenanceWorker();

  // Set up repeatable jobs
  setupRepeatableJobs().catch((err) => {
    console.error('[jobs] Failed to set up repeatable jobs:', err);
  });

  console.log('[jobs] Workers initialized.');
}

async function setupRepeatableJobs() {
  // Location flush: every 5 seconds
  await locationFlushQueue.add(
    'flush-locations',
    {},
    {
      repeat: {
        every: 5000,
      },
      jobId: 'location-flush-repeatable',
    },
  );

  // Driving hours reset: every day at midnight UTC
  await maintenanceQueue.add(
    'driving-hours-reset',
    {},
    {
      repeat: {
        pattern: '0 0 * * *', // Midnight UTC
      },
      jobId: 'driving-hours-reset-nightly',
    },
  );

  console.log('[jobs] Repeatable jobs scheduled.');
}
