import { eq, and } from 'drizzle-orm';
import { db, redis, redisPub, sql } from '../db/connection.js';
import { geofences, geofenceEvents } from '../db/schema.js';
import { haversineDistance } from '@nexus-fleet/shared';

const GEOFENCE_CACHE_TTL = 60; // 60 seconds

interface CachedGeofence {
  id: string;
  tenant_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  trigger_on_enter: boolean;
  trigger_on_exit: boolean;
}

/**
 * Get active geofences for a tenant, with Redis caching.
 */
async function getTenantGeofences(tenantId: string): Promise<CachedGeofence[]> {
  const cacheKey = `geofences:${tenantId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Redis unavailable, fall through to DB
  }

  const rows = await db
    .select({
      id: geofences.id,
      tenant_id: geofences.tenant_id,
      name: geofences.name,
      center_lat: geofences.center_lat,
      center_lng: geofences.center_lng,
      radius_m: geofences.radius_m,
      trigger_on_enter: geofences.trigger_on_enter,
      trigger_on_exit: geofences.trigger_on_exit,
    })
    .from(geofences)
    .where(and(eq(geofences.tenant_id, tenantId), eq(geofences.is_active, true)));

  const result: CachedGeofence[] = rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    center_lat: parseFloat(r.center_lat),
    center_lng: parseFloat(r.center_lng),
    radius_m: parseFloat(r.radius_m),
    trigger_on_enter: r.trigger_on_enter,
    trigger_on_exit: r.trigger_on_exit,
  }));

  try {
    await redis.setex(cacheKey, GEOFENCE_CACHE_TTL, JSON.stringify(result));
  } catch {
    // Cache write failure is non-critical
  }

  return result;
}

/**
 * Check a vehicle's location against all active tenant geofences.
 * Tracks previous state in Redis to generate enter/exit events.
 */
export async function checkGeofences(
  vehicleId: string,
  tenantId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const fences = await getTenantGeofences(tenantId);

  if (fences.length === 0) return;

  for (const fence of fences) {
    const distance = haversineDistance(lat, lng, fence.center_lat, fence.center_lng);
    const distanceM = distance * 1000; // Convert km to m
    const isInside = distanceM <= fence.radius_m;

    // Get previous state from Redis
    const stateKey = `geofence_state:${vehicleId}:${fence.id}`;
    let previousState: string | null = null;

    try {
      previousState = await redis.get(stateKey);
    } catch {
      // Redis unavailable; skip geofence check for this fence
      continue;
    }

    const wasInside = previousState === 'inside';

    // Update state in Redis
    try {
      await redis.setex(stateKey, 3600, isInside ? 'inside' : 'outside');
    } catch {
      continue;
    }

    // Generate events based on state change
    if (isInside && !wasInside && previousState !== null) {
      // ENTER event
      if (fence.trigger_on_enter) {
        await recordGeofenceEvent(tenantId, fence.id, vehicleId, 'enter', lat, lng, fence.name);
      }
    } else if (!isInside && wasInside) {
      // EXIT event
      if (fence.trigger_on_exit) {
        await recordGeofenceEvent(tenantId, fence.id, vehicleId, 'exit', lat, lng, fence.name);
      }
    }

    // If first check (previousState is null), just record state without event
    if (previousState === null) {
      try {
        await redis.setex(stateKey, 3600, isInside ? 'inside' : 'outside');
      } catch {
        // Non-critical
      }
    }
  }
}

async function recordGeofenceEvent(
  tenantId: string,
  geofenceId: string,
  vehicleId: string,
  eventType: 'enter' | 'exit',
  lat: number,
  lng: number,
  geofenceName: string,
): Promise<void> {
  // Write to DB
  await db.insert(geofenceEvents).values({
    tenant_id: tenantId,
    geofence_id: geofenceId,
    vehicle_id: vehicleId,
    event_type: eventType,
    location_lat: String(lat),
    location_lng: String(lng),
  });

  // Publish to Redis for WebSocket push
  try {
    await redisPub.publish(
      `alerts:${tenantId}`,
      JSON.stringify({
        type: 'geofence_event',
        data: {
          geofence_id: geofenceId,
          geofence_name: geofenceName,
          vehicle_id: vehicleId,
          event_type: eventType,
          lat,
          lng,
          timestamp: new Date().toISOString(),
        },
      }),
    );
  } catch {
    // Non-critical
  }
}
