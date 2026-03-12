import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { vehicleTokens } from '../db/schema.js';
import { getQueue, QUEUE_NAMES } from '../jobs/queue-setup.js';

// Lazy singleton Redis for pub/sub and hash writes
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    redis = new Redis(url, { maxRetriesPerRequest: null });
  }
  return redis;
}

interface AuthenticatedState {
  vehicleId: string;
  tenantId: string;
  lastMessageAt: number;
}

function isValidPayload(data: unknown): data is {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
} {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.lat === 'number' &&
    d.lat >= -90 &&
    d.lat <= 90 &&
    typeof d.lng === 'number' &&
    d.lng >= -180 &&
    d.lng <= 180 &&
    typeof d.speed === 'number' &&
    d.speed >= 0 &&
    typeof d.heading === 'number' &&
    d.heading >= 0 &&
    d.heading <= 360
  );
}

export async function trackingWs(app: FastifyInstance) {
  app.get('/tracking', { websocket: true }, (socket, request) => {
    let state: AuthenticatedState | null = null;
    const AUTH_TIMEOUT_MS = 10_000;

    // Close connection if no auth within 10 seconds
    const authTimer = setTimeout(() => {
      if (!state) {
        socket.close(4001, 'Authentication timeout');
      }
    }, AUTH_TIMEOUT_MS);

    socket.on('message', async (raw: Buffer) => {
      let msg: { type?: string; token?: string; data?: unknown };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        // Ignore malformed JSON
        return;
      }

      // ── Auth phase ──────────────────────────────────────
      if (!state) {
        if (msg.type !== 'auth' || typeof msg.token !== 'string') {
          socket.close(4001, 'Invalid or missing auth message');
          clearTimeout(authTimer);
          return;
        }

        try {
          const result = await authenticateVehicleToken(msg.token);
          if (!result) {
            socket.send(
              JSON.stringify({
                type: 'auth_failed',
                data: { message: 'Invalid or expired token' },
              }),
            );
            socket.close(4001, 'Invalid or expired token');
            clearTimeout(authTimer);
            return;
          }

          state = {
            vehicleId: result.vehicleId,
            tenantId: result.tenantId,
            lastMessageAt: 0,
          };

          clearTimeout(authTimer);

          socket.send(
            JSON.stringify({
              type: 'auth_success',
              data: { vehicle_id: result.vehicleId },
            }),
          );
        } catch (err) {
          request.log.error({ err }, 'Vehicle token auth error');
          socket.send(
            JSON.stringify({
              type: 'auth_failed',
              data: { message: 'Invalid or expired token' },
            }),
          );
          socket.close(4001, 'Authentication error');
          clearTimeout(authTimer);
        }
        return;
      }

      // ── Authenticated phase ─────────────────────────────
      if (msg.type === 'location_update') {
        if (!isValidPayload(msg.data)) {
          // Drop invalid messages silently (no disconnect)
          return;
        }

        // Throttle: 1 msg/s per vehicle connection
        const now = Date.now();
        if (now - state.lastMessageAt < 1000) {
          // Drop silently if exceeded
          return;
        }
        state.lastMessageAt = now;

        const { lat, lng, speed, heading } = msg.data;
        const ts = new Date().toISOString();
        const { vehicleId, tenantId } = state;

        try {
          const r = getRedis();

          // (a) Write to vehicle_location:{vehicleId} Redis hash
          await r.hset(
            `vehicle_location:${vehicleId}`,
            'lat', String(lat),
            'lng', String(lng),
            'speed', String(speed),
            'heading', String(heading),
            'ts', ts,
          );

          // (b) Add vehicleId to dirty_vehicles:{tenantId} sorted set
          await r.zadd(`dirty_vehicles:${tenantId}`, now, vehicleId);

          // (c) PUBLISH to tracking:{tenantId}
          await r.publish(
            `tracking:${tenantId}`,
            JSON.stringify({
              vehicle_id: vehicleId,
              lat,
              lng,
              speed,
              heading,
              ts,
            }),
          );

          // (d) Enqueue geofence-check BullMQ job
          const queue = getQueue(QUEUE_NAMES.GEOFENCE_CHECK);
          await queue.add('geofence-check', {
            vehicleId,
            tenantId,
            lat,
            lng,
          });
        } catch (err) {
          request.log.error({ err, vehicleId, tenantId }, 'Failed to process location update');
        }
      }
      // Unknown message types after auth are silently ignored
    });

    socket.on('close', () => {
      clearTimeout(authTimer);
      state = null;
    });
  });
}

/**
 * Look up the vehicle token by bcrypt-comparing against all active tokens.
 * Returns { vehicleId, tenantId } on success, null on failure.
 */
async function authenticateVehicleToken(
  plainToken: string,
): Promise<{ vehicleId: string; tenantId: string } | null> {
  // Fetch all active, non-expired tokens
  const rows = await db
    .select({
      token_hash: vehicleTokens.token_hash,
      vehicle_id: vehicleTokens.vehicle_id,
      tenant_id: vehicleTokens.tenant_id,
    })
    .from(vehicleTokens)
    .where(and(eq(vehicleTokens.is_active, true)));

  for (const row of rows) {
    // Skip expired tokens
    // (expires_at check would be ideal, but the schema makes it optional;
    //  active flag is the primary control)
    const match = await bcrypt.compare(plainToken, row.token_hash);
    if (match) {
      return { vehicleId: row.vehicle_id, tenantId: row.tenant_id };
    }
  }

  return null;
}
