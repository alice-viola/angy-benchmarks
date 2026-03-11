import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { drivers } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import pino from 'pino';

const logger = pino({ name: 'hos-service' });

export async function startDriving(driverId: string) {
  await redis.set(`driving_start:${driverId}`, Date.now().toString());
}

export async function stopDriving(driverId: string) {
  const startStr = await redis.get(`driving_start:${driverId}`);
  if (!startStr) {
    logger.warn({ driverId }, 'No driving_start key found for driver, no-op');
    return;
  }

  const elapsedMs = Date.now() - parseInt(startStr, 10);
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // Atomic DB update + Redis DEL
  await db
    .update(drivers)
    .set({
      current_driving_hours: (
        parseFloat(
          (
            await db
              .select({ h: drivers.current_driving_hours })
              .from(drivers)
              .where(eq(drivers.id, driverId))
              .limit(1)
          )[0]?.h ?? '0',
        ) + elapsedHours
      ).toString(),
    })
    .where(eq(drivers.id, driverId));

  await redis.del(`driving_start:${driverId}`);
}

export async function checkHoursAvailable(driverId: string) {
  const [driver] = await db
    .select({
      current_driving_hours: drivers.current_driving_hours,
      max_driving_hours_day: drivers.max_driving_hours_day,
    })
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver) {
    return { available: false, current: 0, max: 0 };
  }

  let current = parseFloat(driver.current_driving_hours ?? '0');
  const max = parseFloat(driver.max_driving_hours_day ?? '9');

  // Check for in-progress driving
  const startStr = await redis.get(`driving_start:${driverId}`);
  if (startStr) {
    const elapsedMs = Date.now() - parseInt(startStr, 10);
    current += elapsedMs / (1000 * 60 * 60);
  }

  return {
    available: current < max,
    current: Math.round(current * 100) / 100,
    max,
  };
}
