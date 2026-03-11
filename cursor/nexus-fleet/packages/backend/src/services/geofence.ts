import { eq, and, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Database } from '../db/connection.js';
import * as schema from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CachedGeofence {
  id: string;
  name: string;
}

export interface GeofenceCheckResult {
  entered: string[];
  exited: string[];
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const geofenceCacheKey = (tenantId: string) => `geofences:${tenantId}`;
const geofenceStateKey = (vehicleId: string, geofenceId: string) =>
  `geofence_state:${vehicleId}:${geofenceId}`;
const CACHE_TTL_S = 60;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class GeofenceService {
  constructor(
    private db: Database,
    private redis: Redis,
  ) {}

  async checkGeofences(
    vehicleId: string,
    tenantId: string,
    lat: number,
    lng: number,
  ): Promise<GeofenceCheckResult> {
    const activeGeofences = await this.getActiveGeofences(tenantId);
    if (activeGeofences.length === 0) return { entered: [], exited: [] };

    const geofenceIds = activeGeofences.map((g) => g.id);

    const containsResults = await this.batchContainsCheck(geofenceIds, lat, lng);

    const entered: string[] = [];
    const exited: string[] = [];
    const now = new Date();
    const pipeline = this.redis.pipeline();

    for (const gf of activeGeofences) {
      const isInside = containsResults.has(gf.id);
      const stateKey = geofenceStateKey(vehicleId, gf.id);
      const previousState = await this.redis.get(stateKey);
      const wasInside = previousState === 'inside';

      if (isInside && !wasInside) {
        entered.push(gf.id);
        pipeline.set(stateKey, 'inside');

        await this.db.insert(schema.geofenceEvents).values({
          geofenceId: gf.id,
          vehicleId,
          eventType: 'enter',
          location: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
          createdAt: now,
        });
      } else if (!isInside && wasInside) {
        exited.push(gf.id);
        pipeline.set(stateKey, 'outside');

        await this.db.insert(schema.geofenceEvents).values({
          geofenceId: gf.id,
          vehicleId,
          eventType: 'exit',
          location: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
          createdAt: now,
        });
      }
    }

    await pipeline.exec();

    if (entered.length > 0 || exited.length > 0) {
      await this.redis.publish(
        `alerts:${tenantId}`,
        JSON.stringify({
          type: 'geofence.triggered',
          vehicleId,
          entered,
          exited,
          lat,
          lng,
          timestamp: now.toISOString(),
        }),
      );
    }

    return { entered, exited };
  }

  private async getActiveGeofences(tenantId: string): Promise<CachedGeofence[]> {
    const cacheKey = geofenceCacheKey(tenantId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CachedGeofence[];
    }

    const rows = await this.db
      .select({ id: schema.geofences.id, name: schema.geofences.name })
      .from(schema.geofences)
      .where(
        and(
          eq(schema.geofences.tenantId, tenantId),
          eq(schema.geofences.isActive, true),
        ),
      );

    const geofences: CachedGeofence[] = rows.map((r) => ({ id: r.id, name: r.name }));
    await this.redis.set(cacheKey, JSON.stringify(geofences), 'EX', CACHE_TTL_S);
    return geofences;
  }

  /**
   * Runs a single SQL query to check containment against all given geofences.
   * Returns the set of geofence IDs whose geometry contains the given point.
   */
  private async batchContainsCheck(
    geofenceIds: string[],
    lat: number,
    lng: number,
  ): Promise<Set<string>> {
    if (geofenceIds.length === 0) return new Set();

    const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
    const rows = await this.db
      .select({ id: schema.geofences.id })
      .from(schema.geofences)
      .where(
        and(
          sql`${schema.geofences.id} = ANY(${geofenceIds})`,
          sql`ST_Contains(${schema.geofences.geometry}, ${point})`,
        ),
      );

    return new Set(rows.map((r) => r.id));
  }
}
