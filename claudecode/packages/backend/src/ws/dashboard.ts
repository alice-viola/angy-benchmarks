import type { FastifyPluginAsync } from 'fastify';
import jwt from 'jsonwebtoken';
import { redisSub } from '../db/connection.js';

function getPublicKey(): string { return process.env.JWT_PUBLIC_KEY ?? ''; }

// Channel types clients can subscribe to
const VALID_CHANNELS = ['tracking', 'shipment_updates', 'alerts'] as const;
type ChannelType = (typeof VALID_CHANNELS)[number];

interface ClientConnection {
  socket: any;
  tenantId: string;
  userId: string;
  subscriptions: Set<ChannelType>;
}

// Active connections keyed by a unique connection ID
const connections = new Map<string, ClientConnection>();
let connectionCounter = 0;

// Track which Redis channels we've subscribed to
const activeRedisSubscriptions = new Set<string>();

function getRedisChannel(channel: ChannelType, tenantId: string): string {
  switch (channel) {
    case 'tracking':
      return `tracking:${tenantId}`;
    case 'shipment_updates':
      return `shipment_updates:${tenantId}`;
    case 'alerts':
      return `alerts:${tenantId}`;
  }
}

// Set up Redis message handler (once)
let redisHandlerInitialized = false;

function initRedisHandler() {
  if (redisHandlerInitialized) return;
  redisHandlerInitialized = true;

  redisSub.on('message', (channel: string, message: string) => {
    // Fan out to all connected clients subscribed to this channel
    for (const [, client] of connections) {
      for (const sub of client.subscriptions) {
        const redisChannel = getRedisChannel(sub, client.tenantId);
        if (redisChannel === channel) {
          try {
            client.socket.send(message);
          } catch {
            // Client might have disconnected
          }
        }
      }
    }
  });
}

async function subscribeToRedisChannel(channel: string) {
  if (activeRedisSubscriptions.has(channel)) return;
  activeRedisSubscriptions.add(channel);
  await redisSub.subscribe(channel);
}

async function maybeUnsubscribeFromRedisChannel(channel: string) {
  // Check if any remaining connections need this channel
  for (const [, client] of connections) {
    for (const sub of client.subscriptions) {
      if (getRedisChannel(sub, client.tenantId) === channel) {
        return; // Still needed
      }
    }
  }
  activeRedisSubscriptions.delete(channel);
  await redisSub.unsubscribe(channel);
}

export const dashboardWsHandler: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/ws/dashboard',
    { websocket: true, config: { skipAuth: true } },
    async (socket, request) => {
      initRedisHandler();

      let connectionId: string | null = null;
      let authenticated = false;

      // Set up ping/pong heartbeat
      const heartbeatInterval = setInterval(() => {
        if (authenticated) {
          try {
            socket.send(JSON.stringify({ type: 'ping', data: { timestamp: Date.now() } }));
          } catch {
            // Connection might be closed
          }
        }
      }, 30000);

      socket.on('message', async (rawMessage: Buffer) => {
        try {
          const message = JSON.parse(rawMessage.toString());

          // Handle authentication
          if (message.type === 'auth') {
            try {
              const payload = jwt.verify(message.token, getPublicKey(), {
                algorithms: ['RS256'],
              }) as { sub: string; tid: string; role: string };

              connectionId = `conn_${++connectionCounter}`;
              authenticated = true;

              connections.set(connectionId, {
                socket,
                tenantId: payload.tid,
                userId: payload.sub,
                subscriptions: new Set(),
              });

              socket.send(
                JSON.stringify({
                  type: 'auth_ok',
                  data: { connectionId, tenantId: payload.tid },
                }),
              );
            } catch {
              socket.send(
                JSON.stringify({ type: 'auth_error', data: { message: 'Invalid token' } }),
              );
              socket.close(4001, 'Authentication failed');
            }
            return;
          }

          if (!authenticated || !connectionId) {
            socket.send(
              JSON.stringify({ type: 'error', data: { message: 'Not authenticated' } }),
            );
            return;
          }

          const client = connections.get(connectionId);
          if (!client) return;

          // Handle subscribe
          if (message.type === 'subscribe') {
            const channel = message.channel as ChannelType;
            if (!VALID_CHANNELS.includes(channel)) {
              socket.send(
                JSON.stringify({
                  type: 'error',
                  data: { message: `Invalid channel: ${channel}. Valid: ${VALID_CHANNELS.join(', ')}` },
                }),
              );
              return;
            }

            client.subscriptions.add(channel);
            const redisChannel = getRedisChannel(channel, client.tenantId);
            await subscribeToRedisChannel(redisChannel);

            socket.send(
              JSON.stringify({
                type: 'subscribed',
                data: { channel, subscriptions: Array.from(client.subscriptions) },
              }),
            );
          }

          // Handle unsubscribe
          if (message.type === 'unsubscribe') {
            const channel = message.channel as ChannelType;
            client.subscriptions.delete(channel);

            const redisChannel = getRedisChannel(channel, client.tenantId);
            await maybeUnsubscribeFromRedisChannel(redisChannel);

            socket.send(
              JSON.stringify({
                type: 'unsubscribed',
                data: { channel, subscriptions: Array.from(client.subscriptions) },
              }),
            );
          }

          // Handle pong (response to our ping)
          if (message.type === 'pong') {
            // Client is alive, nothing to do
          }
        } catch {
          socket.send(
            JSON.stringify({ type: 'error', data: { message: 'Invalid message format' } }),
          );
        }
      });

      const cleanup = async () => {
        clearInterval(heartbeatInterval);
        if (connectionId) {
          const client = connections.get(connectionId);
          if (client) {
            // Unsubscribe from Redis channels if no other clients need them
            for (const sub of client.subscriptions) {
              const redisChannel = getRedisChannel(sub, client.tenantId);
              connections.delete(connectionId);
              await maybeUnsubscribeFromRedisChannel(redisChannel);
            }
            connections.delete(connectionId);
          }
        }
      };

      socket.on('close', cleanup);
      socket.on('error', cleanup);
    },
  );
};
