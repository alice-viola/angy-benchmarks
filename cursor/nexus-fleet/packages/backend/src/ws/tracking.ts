import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { locationUpdateSchema } from '@nexus-fleet/shared';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const lastMessageTime = new Map<string, number>();
const THROTTLE_MS = 1000;

interface VehicleToken {
  vehicleId: string;
  tenantId: string;
}

export default async function trackingWs(fastify: FastifyInstance) {
  fastify.get(
    '/ws/tracking',
    { websocket: true },
    async (socket: WebSocket, request) => {
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        socket.close(4001, 'Missing authentication token');
        return;
      }

      let vehicleAuth: VehicleToken;
      try {
        vehicleAuth = jwt.verify(token, JWT_SECRET) as VehicleToken;
      } catch {
        socket.close(4001, 'Invalid authentication token');
        return;
      }

      const { vehicleId, tenantId } = vehicleAuth;
      fastify.log.info({ vehicleId, tenantId }, 'Vehicle tracking WS connected');

      socket.on('message', async (rawData) => {
        try {
          const now = Date.now();
          const lastTime = lastMessageTime.get(vehicleId) ?? 0;
          if (now - lastTime < THROTTLE_MS) {
            socket.send(JSON.stringify({ error: 'RATE_LIMITED', message: 'Max 1 update per second' }));
            return;
          }
          lastMessageTime.set(vehicleId, now);

          const parsed = JSON.parse(rawData.toString());
          const data = locationUpdateSchema.parse(parsed);

          if (data.vehicleId !== vehicleId) {
            socket.send(
              JSON.stringify({ error: 'FORBIDDEN', message: 'vehicleId mismatch' }),
            );
            return;
          }

          const locationData = {
            lat: data.lat,
            lng: data.lng,
            speed: data.speed ?? 0,
            heading: data.heading ?? 0,
            accuracy: data.accuracy ?? 0,
            timestamp: data.timestamp,
            vehicleId,
            tenantId,
          };

          // Write to Redis hash for latest location
          await redis.hset(
            `vehicle:${vehicleId}:location`,
            'lat', data.lat.toString(),
            'lng', data.lng.toString(),
            'speed', (data.speed ?? 0).toString(),
            'heading', (data.heading ?? 0).toString(),
            'accuracy', (data.accuracy ?? 0).toString(),
            'timestamp', data.timestamp,
            'tenantId', tenantId,
          );

          // Mark vehicle as dirty for batch flush to DB
          await redis.zadd('dirty-vehicles', now.toString(), vehicleId);

          // Publish to Redis pub/sub for real-time fan-out
          await redis.publish(
            `tenant:${tenantId}:tracking`,
            JSON.stringify(locationData),
          );

          socket.send(JSON.stringify({ ack: true, timestamp: data.timestamp }));
        } catch (err: any) {
          const message = err.issues
            ? 'Validation failed'
            : err.message || 'Invalid message';
          socket.send(
            JSON.stringify({
              error: 'INVALID_MESSAGE',
              message,
              details: err.issues ?? undefined,
            }),
          );
        }
      });

      socket.on('close', () => {
        lastMessageTime.delete(vehicleId);
        fastify.log.info({ vehicleId }, 'Vehicle tracking WS disconnected');
      });

      socket.on('error', (err) => {
        fastify.log.error({ vehicleId, err }, 'Vehicle tracking WS error');
      });
    },
  );
}
