import type { Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';

export async function processDrivingHoursReset(_job: Job) {
  const result = await db.execute(sql`
    UPDATE drivers
    SET current_driving_hours = 0,
        updated_at = NOW()
    WHERE is_active = true
  `);

  const rowCount = (result as any).rowCount ?? 0;

  console.log(`[maintenance] Reset driving hours for ${rowCount} active drivers`);

  return { driversReset: rowCount };
}
