import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { env } from '../env.js';
import { redis } from '../lib/redis.js';
import { canConnect, trackConnection } from './connection-limiter.js';
import * as geofenceCheckerService from '../services/geofence-checker.service.js';
import type { JwtPayload } from '../plugins/auth.plugin.js';

const publicKey = readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf-8');

const locationUpdateSchema = z.object({
  type: z.literal('location_update'),
  vehicle_id: z.string().uuid(),
  vehicle_registration: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed_kmh: z.number().min(0).max(300),
  heading: z.number().min(0).lt(360),
  timestamp: z.string().refine((ts) => {
    const t = new Date(ts).getTime();
    if (Number.isNaN(t)) return false;
    const now = Date.now();
    return t >= now - 5 * 60 * 1000 && t <= now + 30 * 1000;
  }, 'Timestamp must be within 5min past and 30s future'),
});

// Per-vehicle throttle map: vehicleId -> timeout handle
const throttleMap = new Map<string, { timeout: NodeJS.Timeout; latest: z.infer<typeof locationUpdateSchema>; tenantId: string }>();

function getTenantPlan(tenantId: string): Promise<string> {
  return redis.get(`tenant:${tenantId}`).then((cached) => {
    if (cached) {
      try {
        return JSON.parse(cached).plan || 'free';
      } catch {
        return 'free';
      }
    }
    return 'free';
  });
}

async function processUpdate(tenantId: string, data: z.infer<typeof locationUpdateSchema>): Promise<void> {
  const { vehicle_id, lat, lng, speed_kmh, heading, timestamp, vehicle_registration } = data;

  // a. HSET vehicle location
  await redis.hset(`vehicle_location:${vehicle_id}`, {
    lat: lat.toString(),
    lng: lng.toString(),
    speed_kmh: speed_kmh.toString(),
    heading: heading.toString(),
    timestamp,
    vehicle_id,
    tenant_id: tenantId,
  });

  // b. ZADD dirty vehicles
  await redis.zadd(`dirty_vehicles:${tenantId}`, Date.now(), vehicle_id);

  // c. Publish to tracking channel
  await redis.publish(
    `tracking:${tenantId}`,
    JSON.stringify({
      event: 'vehicle_location',
      vehicle_id,
      lat,
      lng,
      speed_kmh,
      heading,
      timestamp,
    }),
  );

  // d. Check geofences
  geofenceCheckerService
    .checkVehicle(tenantId, vehicle_id, vehicle_registration || vehicle_id, lat, lng)
    .catch(() => {
      // Non-critical — don't crash the handler
    });
}

export async function handler(app: FastifyInstance): Promise<void> {
  app.get('/ws/tracking', { websocket: true }, (socket: WebSocket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.close(4001, 'Missing token');
      return;
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }) as JwtPayload;
    } catch {
      socket.close(4001, 'Invalid token');
      return;
    }

    const tenantId = decoded.tid;

    // Check connection limit
    getTenantPlan(tenantId).then((plan) => {
      if (!canConnect(tenantId, plan)) {
        socket.close(4029, 'Connection limit exceeded');
        return;
      }

      const cleanup = trackConnection(tenantId);

      socket.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type !== 'location_update') return;

          const parsed = locationUpdateSchema.safeParse(msg);
          if (!parsed.success) return;

          const vehicleId = parsed.data.vehicle_id;

          // Throttle: 1 msg/sec per vehicle
          const existing = throttleMap.get(vehicleId);
          if (existing) {
            // Update latest, drop excess
            existing.latest = parsed.data;
            existing.tenantId = tenantId;
            return;
          }

          // Process immediately, then set 1s cooldown
          processUpdate(tenantId, parsed.data).catch(() => {});

          const timeout = setTimeout(() => {
            const entry = throttleMap.get(vehicleId);
            throttleMap.delete(vehicleId);
            if (entry && entry.latest !== parsed.data) {
              processUpdate(entry.tenantId, entry.latest).catch(() => {});
            }
          }, 1000);

          throttleMap.set(vehicleId, { timeout, latest: parsed.data, tenantId });
        } catch {
          // Invalid JSON — ignore
        }
      });

      socket.on('close', () => {
        cleanup();
      });
    });
  });
}
