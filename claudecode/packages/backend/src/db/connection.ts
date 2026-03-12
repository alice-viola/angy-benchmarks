import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import Redis from 'ioredis';
import * as schema from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/nexusfleet';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// PostgreSQL connection
const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Drizzle ORM instance
export const db = drizzle(sql, { schema });

// Raw sql client for raw queries
export { sql };

// Redis connection
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: false,
});

// Redis subscriber (separate connection for pub/sub)
export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: false,
});

// Redis publisher (separate connection for pub/sub)
export const redisPub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: false,
});
