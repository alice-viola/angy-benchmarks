import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import Redis from 'ioredis';
import { env } from '../env.js';
import { canConnect, trackConnection } from './connection-limiter.js';
import { redis } from '../lib/redis.js';
import type { JwtPayload } from '../plugins/auth.plugin.js';

const publicKey = readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf-8');

const VALID_CHANNELS = new Set(['tracking', 'shipment_updates', 'alerts']);

// Map connectionId -> subscribed channels
const subscriptions = new Map<string, Set<string>>();

let connectionCounter = 0;

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

export async function handler(app: FastifyInstance): Promise<void> {
  app.get('/ws/dashboard', { websocket: true }, (socket: WebSocket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    let authenticated = false;
    let tenantId: string | null = null;
    let cleanup: (() => void) | null = null;
    const connectionId = `dash-${++connectionCounter}-${Date.now()}`;
    let subscriber: Redis | null = null;

    function authenticate(jwtToken: string): boolean {
      try {
        const decoded = jwt.verify(jwtToken, publicKey, {
          algorithms: ['RS256'],
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
        }) as JwtPayload;
        tenantId = decoded.tid;
        return true;
      } catch {
        return false;
      }
    }

    function setupSubscriptions(): void {
      if (!tenantId) return;

      // Create a dedicated subscriber connection
      subscriber = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: false,
      });

      const tid = tenantId;

      // Subscribe to all tenant channels
      const channels = [
        `tracking:${tid}`,
        `shipment_updates:${tid}`,
        `alerts:${tid}`,
      ];
      subscriber.subscribe(...channels).catch(() => {});

      subscriber.on('message', (channel: string, message: string) => {
        const myChannels = subscriptions.get(connectionId);
        if (!myChannels) return;

        // Extract channel type from Redis channel name (e.g., "tracking:uuid" -> "tracking")
        const channelType = channel.split(':')[0];
        if (!myChannels.has(channelType)) return;

        try {
          socket.send(
            JSON.stringify({
              channel: channelType,
              data: JSON.parse(message),
            }),
          );
        } catch {
          // Send failed — connection might be closing
        }
      });
    }

    function initConnection(): void {
      if (!tenantId) return;

      getTenantPlan(tenantId).then((plan) => {
        if (!canConnect(tenantId!, plan)) {
          socket.close(4029, 'Connection limit exceeded');
          return;
        }

        cleanup = trackConnection(tenantId!);
        subscriptions.set(connectionId, new Set());
        setupSubscriptions();
      });
    }

    // Try token from query param first
    if (token) {
      if (authenticate(token)) {
        authenticated = true;
        initConnection();
      } else {
        socket.close(4001, 'Invalid token');
        return;
      }
    }

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Allow auth via first message if not already authenticated
        if (!authenticated && msg.type === 'auth' && msg.token) {
          if (authenticate(msg.token)) {
            authenticated = true;
            initConnection();
            socket.send(JSON.stringify({ type: 'auth', status: 'ok' }));
          } else {
            socket.close(4001, 'Invalid token');
          }
          return;
        }

        if (!authenticated) return;

        // Handle ping
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Handle subscribe
        if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
          const myChannels = subscriptions.get(connectionId);
          if (!myChannels) return;

          for (const ch of msg.channels) {
            if (typeof ch === 'string' && VALID_CHANNELS.has(ch)) {
              myChannels.add(ch);
            }
          }

          socket.send(
            JSON.stringify({
              type: 'subscribed',
              channels: Array.from(myChannels),
            }),
          );
          return;
        }
      } catch {
        // Invalid JSON — ignore
      }
    });

    socket.on('close', () => {
      subscriptions.delete(connectionId);
      if (subscriber) {
        subscriber.disconnect();
        subscriber = null;
      }
      if (cleanup) cleanup();
    });
  });
}
