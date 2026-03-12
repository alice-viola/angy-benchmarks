import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { geofenceEvents } from '../db/schema.js';
import { QUEUE_NAMES } from './queue-setup.js';

interface GeofenceCheckData {
  vehicle_id?: string;
  tenant_id?: string;
  // Also accept camelCase (sent by tracking WS)
  vehicleId?: string;
  tenantId?: string;
  lat: number;
  lng: number;
}

interface MatchedGeofence {
  id: string;
  name: string;
  trigger_on_enter: boolean;
  trigger_on_exit: boolean;
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    redis = new Redis(url, { maxRetriesPerRequest: null });
  }
  return redis;
}

export async function processGeofenceCheck(job: Job<GeofenceCheckData>) {
  const vehicleId = job.data.vehicle_id ?? job.data.vehicleId!;
  const tenantId = job.data.tenant_id ?? job.data.tenantId!;
  const { lat, lng } = job.data;

  // 1. Single batched ST_Contains query — hits GIST index on geometry column
  const matchedRows = await db.execute(sql`
    SELECT id, name, trigger_on_enter, trigger_on_exit
    FROM geofences
    WHERE tenant_id = ${tenantId}
      AND is_active = true
      AND ST_Contains(geometry, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
  `);

  const matched = (matchedRows as any).rows as MatchedGeofence[] ?? [];
  const matchedIds = new Set(matched.map((f) => f.id));

  // 2. Load previous geofence state from Redis for this vehicle
  const r = getRedis();
  const stateKey = `geofence_state:${vehicleId}`;
  const previousState = await r.hgetall(stateKey);
  // previousState is { [geofenceId]: "inside" | "outside" }

  const previousInsideIds = new Set(
    Object.entries(previousState)
      .filter(([, v]) => v === 'inside')
      .map(([k]) => k),
  );

  // 3. Determine enter/exit transitions
  const events: Array<{ geofenceId: string; geofenceName: string; eventType: 'enter' | 'exit' }> = [];

  // Enter: currently inside, was NOT inside before
  for (const fence of matched) {
    if (!previousInsideIds.has(fence.id) && fence.trigger_on_enter) {
      events.push({ geofenceId: fence.id, geofenceName: fence.name, eventType: 'enter' });
    }
  }

  // Exit: was inside before, NOT inside now
  for (const [fenceId, state] of Object.entries(previousState)) {
    if (state === 'inside' && !matchedIds.has(fenceId)) {
      // Need trigger_on_exit — fetch from matched or check if the fence was tracked
      // We only care about exit events for fences we previously tracked
      events.push({ geofenceId: fenceId, geofenceName: '', eventType: 'exit' });
    }
  }

  // 4. Update Redis state: set matched fences to "inside", exited fences to "outside"
  const pipeline = r.pipeline();
  for (const fence of matched) {
    pipeline.hset(stateKey, fence.id, 'inside');
  }
  for (const [fenceId, state] of Object.entries(previousState)) {
    if (state === 'inside' && !matchedIds.has(fenceId)) {
      pipeline.hset(stateKey, fenceId, 'outside');
    }
  }
  await pipeline.exec();

  // 5. Write geofence_events and publish alerts for each transition
  const now = new Date();
  const createdEvents = [];

  for (const ev of events) {
    // For exit events, check trigger_on_exit from DB if needed
    if (ev.eventType === 'exit') {
      const exitFenceRows = await db.execute(sql`
        SELECT trigger_on_exit, name FROM geofences WHERE id = ${ev.geofenceId} AND tenant_id = ${tenantId}
      `);
      const exitFence = ((exitFenceRows as any).rows as Array<{ trigger_on_exit: boolean; name: string }>)?.[0];
      if (!exitFence || !exitFence.trigger_on_exit) continue;
      ev.geofenceName = exitFence.name;
    }

    const [event] = await db
      .insert(geofenceEvents)
      .values({
        tenant_id: tenantId,
        geofence_id: ev.geofenceId,
        vehicle_id: vehicleId,
        event_type: ev.eventType,
        location: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
        triggered_at: now,
      })
      .returning();

    createdEvents.push(event);

    // Publish alert to Redis for WS fan-out
    await r.publish(
      `alerts:${tenantId}`,
      JSON.stringify({
        type: 'geofence_alert',
        data: {
          geofence_id: ev.geofenceId,
          geofence_name: ev.geofenceName,
          vehicle_id: vehicleId,
          event_type: ev.eventType,
          location: { lat, lng },
          triggered_at: now.toISOString(),
        },
      }),
    );
  }

  return { checked: matched.length, events_created: createdEvents.length };
}

export function createGeofenceCheckWorker() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker(QUEUE_NAMES.GEOFENCE_CHECK, processGeofenceCheck, {
    connection: connection as any,
    concurrency: 5,
  });
}
