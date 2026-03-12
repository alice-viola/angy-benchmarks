import { redis, db, sql as rawSql } from '../db/connection.js';
import { shipments } from '../db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';
import { formatReferenceCode } from '@nexus-fleet/shared';

/**
 * Generate a shipment reference code: SHP-{YYYYMMDD}-{NNNNN}
 * Uses Redis INCR for atomic sequence generation.
 * Falls back to DB SELECT MAX if Redis is unavailable.
 */
export async function generateReferenceCode(tenantId: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const redisKey = `shipment_seq:${tenantId}:${dateStr}`;

  let sequence: number;

  try {
    // Try Redis INCR for atomic sequence
    sequence = await redis.incr(redisKey);
    // Set expiry to 48 hours (in case of date rollover)
    await redis.expire(redisKey, 172800);
  } catch {
    // Fallback to DB-based sequence
    const [result] = await db
      .select({ reference_code: shipments.reference_code })
      .from(shipments)
      .where(
        sql`${shipments.reference_code} LIKE ${'SHP-' + dateStr + '-%'}`,
      )
      .orderBy(desc(shipments.reference_code))
      .limit(1);

    if (result) {
      const parts = result.reference_code.split('-');
      const lastSeq = parseInt(parts[2], 10);
      sequence = lastSeq + 1;
    } else {
      sequence = 1;
    }
  }

  return formatReferenceCode(now, sequence);
}
