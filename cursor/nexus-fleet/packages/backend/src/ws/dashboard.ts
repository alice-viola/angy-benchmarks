import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { wsMessageSchema } from '@nexus-fleet/shared';
import type { WsChannel } from '@nexus-fleet/shared';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const HEARTBEAT_TIMEOUT_MS = 35_000;

const CHANNEL_MAP: Record<WsChannel, string> = {
  tracking: 'tracking',
  shipment_updates: 'shipment_updates',
  alerts: 'alerts',
};

interface ConnectionState {
  ws: WebSocket;
  tenantId: string;
  userId: string;
  subscriptions: Set<WsChannel>;
  heartbeatTimer: ReturnType<typeof setTimeout> | null;
}

const connections = new Map<string, ConnectionState>();

// One subscriber Redis client per tenant (shared across connections)
const tenantSubscribers = new Map<string, Redis>();
const tenantConnectionIds = new Map<string, Set<string>>();

function getOrCreateSubscriber(tenantId: string, fastify: FastifyInstance): Redis {
  let sub = tenantSubscribers.get(tenantId);
  if (sub) return sub;

  sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  sub.on('message', (channel: string, message: string) => {
    const connIds = tenantConnectionIds.get(tenantId);
    if (!connIds) return;

    // Determine which WsChannel this Redis channel maps to
    const redisSuffix = channel.split(':').pop();
    const wsChannel = Object.entries(CHANNEL_MAP).find(
      ([, v]) => v === redisSuffix,
    )?.[0] as WsChannel | undefined;

    if (!wsChannel) return;

    for (const connId of connIds) {
      const conn = connections.get(connId);
      if (!conn) continue;
      if (!conn.subscriptions.has(wsChannel)) continue;
      if (conn.ws.readyState !== conn.ws.OPEN) continue;

      conn.ws.send(
        JSON.stringify({ type: 'message', channel: wsChannel, data: JSON.parse(message) }),
      );
    }
  });

  tenantSubscribers.set(tenantId, sub);
  return sub;
}

function resetHeartbeat(connId: string) {
  const conn = connections.get(connId);
  if (!conn) return;

  if (conn.heartbeatTimer) clearTimeout(conn.heartbeatTimer);

  conn.heartbeatTimer = setTimeout(() => {
    conn.ws.close(4008, 'Heartbeat timeout');
  }, HEARTBEAT_TIMEOUT_MS);
}

async function subscribeTenantChannel(tenantId: string, channel: WsChannel) {
  const sub = tenantSubscribers.get(tenantId);
  if (!sub) return;

  const redisChannel = `tenant:${tenantId}:${CHANNEL_MAP[channel]}`;
  const currentSubs = await sub.pubsub('CHANNELS', redisChannel);
  if ((currentSubs as string[]).length === 0) {
    await sub.subscribe(redisChannel);
  }
}

export default async function dashboardWs(fastify: FastifyInstance) {
  fastify.get(
    '/ws/dashboard',
    { websocket: true },
    async (socket: WebSocket, request) => {
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        socket.close(4001, 'Missing authentication token');
        return;
      }

      let payload: { sub: string; tenantId: string; role: string };
      try {
        payload = jwt.verify(token, JWT_SECRET) as typeof payload;
      } catch {
        socket.close(4001, 'Invalid authentication token');
        return;
      }

      const connId = randomUUID();
      const { sub: userId, tenantId } = payload;

      const connState: ConnectionState = {
        ws: socket,
        tenantId,
        userId,
        subscriptions: new Set(),
        heartbeatTimer: null,
      };

      connections.set(connId, connState);

      if (!tenantConnectionIds.has(tenantId)) {
        tenantConnectionIds.set(tenantId, new Set());
      }
      tenantConnectionIds.get(tenantId)!.add(connId);

      getOrCreateSubscriber(tenantId, fastify);
      resetHeartbeat(connId);

      fastify.log.info({ connId, userId, tenantId }, 'Dashboard WS connected');

      socket.send(JSON.stringify({ type: 'connected', connectionId: connId }));

      socket.on('message', async (rawData) => {
        try {
          const parsed = JSON.parse(rawData.toString());

          // Handle ping/pong heartbeat
          if (parsed.type === 'ping') {
            resetHeartbeat(connId);
            socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            return;
          }

          const msg = wsMessageSchema.parse(parsed);

          if (msg.action === 'subscribe') {
            connState.subscriptions.add(msg.channel);
            await subscribeTenantChannel(tenantId, msg.channel);
            socket.send(
              JSON.stringify({
                type: 'subscribed',
                channel: msg.channel,
                channels: [...connState.subscriptions],
              }),
            );
          } else if (msg.action === 'unsubscribe') {
            connState.subscriptions.delete(msg.channel);
            socket.send(
              JSON.stringify({
                type: 'unsubscribed',
                channel: msg.channel,
                channels: [...connState.subscriptions],
              }),
            );
          }
        } catch (err: any) {
          socket.send(
            JSON.stringify({
              type: 'error',
              message: err.issues ? 'Validation failed' : err.message || 'Invalid message',
              details: err.issues ?? undefined,
            }),
          );
        }
      });

      socket.on('close', () => {
        if (connState.heartbeatTimer) clearTimeout(connState.heartbeatTimer);
        connections.delete(connId);

        const tenantConns = tenantConnectionIds.get(tenantId);
        if (tenantConns) {
          tenantConns.delete(connId);
          if (tenantConns.size === 0) {
            tenantConnectionIds.delete(tenantId);
            const sub = tenantSubscribers.get(tenantId);
            if (sub) {
              sub.disconnect();
              tenantSubscribers.delete(tenantId);
            }
          }
        }

        fastify.log.info({ connId, userId }, 'Dashboard WS disconnected');
      });

      socket.on('error', (err) => {
        fastify.log.error({ connId, err }, 'Dashboard WS error');
      });
    },
  );
}
