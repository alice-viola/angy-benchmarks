import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

let connection: Redis | null = null;

function getConnection(): Redis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection: getConnection() as any }));
  }
  return queues.get(name)!;
}

export const QUEUE_NAMES = {
  ROUTE_OPTIMIZATION: 'route-optimization',
  LOCATION_FLUSH: 'location-flush',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  DRIVING_HOURS_RESET: 'driving-hours-reset',
  GEOFENCE_CHECK: 'geofence-check',
} as const;
