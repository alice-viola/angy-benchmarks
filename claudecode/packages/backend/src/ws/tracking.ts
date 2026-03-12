import type { FastifyPluginAsync } from 'fastify';
import jwt from 'jsonwebtoken';
import { redis, redisPub } from '../db/connection.js';
import { locationUpdateSchema } from '@nexus-fleet/shared';
import { checkGeofences } from '../services/geofence-checker.js';

function getPublicKey(): string { return process.env.JWT_PUBLIC_KEY ?? ''; }

// Track last message timestamp per vehicle for throttling
const lastMessageTime = new Map<string, number>();
const THROTTLE_MS = 1000; // Max 1 message per second per vehicle

export const trackingWsHandler: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/ws/tracking',
    { websocket: true, config: { skipAuth: true } },
    async (socket, request) => {
      let vehicleId: string | null = null;
      let tenantId: string | null = null;
      let authenticated = false;

      socket.on('message', async (rawMessage: Buffer) => {
        try {
          const message = JSON.parse(rawMessage.toString());

          // Handle authentication
          if (message.type === 'auth') {
            try {
              const payload = jwt.verify(message.token, getPublicKey(), {
                algorithms: ['RS256'],
              }) as { vid: string; tid: string };

              vehicleId = payload.vid;
              tenantId = payload.tid;
              authenticated = true;

              socket.send(
                JSON.stringify({ type: 'auth_ok', data: { vehicleId, tenantId } }),
              );
            } catch {
              socket.send(
                JSON.stringify({ type: 'auth_error', data: { message: 'Invalid token' } }),
              );
              socket.close(4001, 'Authentication failed');
            }
            return;
          }

          // Require authentication for all other messages
          if (!authenticated || !vehicleId || !tenantId) {
            socket.send(
              JSON.stringify({ type: 'error', data: { message: 'Not authenticated' } }),
            );
            return;
          }

          // Handle location updates
          if (message.type === 'location') {
            // Throttle: max 1 message per second per vehicle
            const now = Date.now();
            const lastTime = lastMessageTime.get(vehicleId) ?? 0;
            if (now - lastTime < THROTTLE_MS) {
              return; // Silently drop throttled messages
            }
            lastMessageTime.set(vehicleId, now);

            // Validate location data
            const parsed = locationUpdateSchema.safeParse(message.data);
            if (!parsed.success) {
              socket.send(
                JSON.stringify({
                  type: 'validation_error',
                  data: { errors: parsed.error.issues },
                }),
              );
              return;
            }

            const location = parsed.data;

            // Store latest location in Redis hash
            await redis.hmset(`vehicle_location:${vehicleId}`, {
              lat: String(location.lat),
              lng: String(location.lng),
              speed_kmh: String(location.speed_kmh),
              heading: String(location.heading),
              timestamp: location.timestamp,
              vehicle_id: vehicleId,
              tenant_id: tenantId,
            });

            // Set TTL on location key (5 minutes - stale after that)
            await redis.expire(`vehicle_location:${vehicleId}`, 300);

            // Add to dirty set for batch flushing to DB
            await redis.sadd(`dirty_vehicles:${tenantId}`, vehicleId);

            // Publish to Redis channel for real-time dashboard updates
            await redisPub.publish(
              `tracking:${tenantId}`,
              JSON.stringify({
                type: 'vehicle_location',
                data: {
                  vehicle_id: vehicleId,
                  ...location,
                },
              }),
            );

            // Trigger geofence checking (non-blocking)
            checkGeofences(vehicleId, tenantId, location.lat, location.lng).catch(() => {
              // Geofence check failure is non-critical
            });

            socket.send(JSON.stringify({ type: 'location_ack' }));
          }

          // Handle ping
          if (message.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }));
          }
        } catch (err) {
          socket.send(
            JSON.stringify({ type: 'error', data: { message: 'Invalid message format' } }),
          );
        }
      });

      socket.on('close', () => {
        if (vehicleId) {
          lastMessageTime.delete(vehicleId);
        }
      });

      socket.on('error', () => {
        if (vehicleId) {
          lastMessageTime.delete(vehicleId);
        }
      });
    },
  );
};
