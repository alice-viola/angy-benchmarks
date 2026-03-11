import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { geofenceEvents, notifications, users } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { publishAlert } from './realtime.service.js';
import { eq, and, inArray } from 'drizzle-orm';

const CACHE_TTL = 60; // seconds

interface GeofenceCacheEntry {
  id: string;
  name: string;
  trigger_on_enter: boolean;
  trigger_on_exit: boolean;
}

export async function checkVehicle(
  tenantId: string,
  vehicleId: string,
  vehicleRegistration: string,
  lat: number,
  lng: number,
): Promise<void> {
  // Load active geofences from cache
  const cacheKey = `geofences:${tenantId}`;
  let cached = await redis.get(cacheKey);

  if (!cached) {
    // Cache miss — load from DB and populate
    const rows = await db.execute(
      sql`SELECT id, name, trigger_on_enter, trigger_on_exit
          FROM geofences
          WHERE tenant_id = ${tenantId} AND is_active = true`,
    );
    if (!rows.length) return;
    cached = JSON.stringify(rows as unknown as GeofenceCacheEntry[]);
    await redis.set(cacheKey, cached, 'EX', CACHE_TTL);
  }

  const geofenceList: GeofenceCacheEntry[] = JSON.parse(cached);
  if (!geofenceList.length) return;

  // Batch spatial query
  interface CheckRow {
    id: string;
    name: string;
    trigger_on_enter: boolean;
    trigger_on_exit: boolean;
    is_inside: boolean;
  }

  const checkRows = (await db.execute(
    sql`SELECT g.id, g.name, g.trigger_on_enter, g.trigger_on_exit,
               ST_Contains(g.geometry, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)) AS is_inside
        FROM geofences g
        WHERE g.tenant_id = ${tenantId} AND g.is_active = true`,
  )) as unknown as CheckRow[];

  const now = new Date().toISOString();

  for (const fence of checkRows) {
    const stateKey = `geofence_state:${vehicleId}:${fence.id}`;
    const previousState = await redis.get(stateKey);
    const currentState = fence.is_inside ? 'inside' : 'outside';

    // Detect transitions
    const entered =
      fence.trigger_on_enter &&
      currentState === 'inside' &&
      (previousState === 'outside' || previousState === null);

    const exited =
      fence.trigger_on_exit &&
      currentState === 'outside' &&
      previousState === 'inside';

    if (entered || exited) {
      const eventType = entered ? 'enter' : 'exit';

      // Insert geofence event
      await db.insert(geofenceEvents).values({
        tenant_id: tenantId,
        geofence_id: fence.id,
        vehicle_id: vehicleId,
        event_type: eventType as 'enter' | 'exit',
        lat: lat.toString(),
        lng: lng.toString(),
      });

      // Insert notifications for owner/admin/dispatcher users
      const activeUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.tenant_id, tenantId),
            eq(users.is_active, true),
            inArray(users.role, ['owner', 'admin', 'dispatcher']),
          ),
        );

      if (activeUsers.length) {
        await db.insert(notifications).values(
          activeUsers.map((u) => ({
            tenant_id: tenantId,
            user_id: u.id,
            type: 'warning',
            title: `Geofence ${eventType}: ${fence.name}`,
            body: `Vehicle ${vehicleRegistration} ${eventType === 'enter' ? 'entered' : 'exited'} geofence "${fence.name}"`,
            data: { geofence_id: fence.id, vehicle_id: vehicleId, event_type: eventType },
          })),
        );
      }

      // Publish alert
      await publishAlert(tenantId, {
        event: 'geofence_alert',
        geofence_id: fence.id,
        geofence_name: fence.name,
        vehicle_id: vehicleId,
        vehicle_registration: vehicleRegistration,
        event_type: eventType,
        lat,
        lng,
        timestamp: now,
      });

      // Enqueue webhook job (import queue lazily to avoid circular deps)
      try {
        const { webhooksQueue } = await import('../jobs/queue.js');
        await webhooksQueue.add('deliver-webhook', {
          event: 'geofence.triggered',
          tenant_id: tenantId,
          payload: {
            geofence_id: fence.id,
            geofence_name: fence.name,
            vehicle_id: vehicleId,
            vehicle_registration: vehicleRegistration,
            event_type: eventType,
            lat,
            lng,
            timestamp: now,
          },
        }, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 60000 },
        });
      } catch {
        // Queue not available — non-critical
      }
    }

    // Update state for all checked fences
    await redis.set(stateKey, currentState, 'EX', 3600);
  }
}

export async function invalidateCache(tenantId: string): Promise<void> {
  await redis.del(`geofences:${tenantId}`);
}
