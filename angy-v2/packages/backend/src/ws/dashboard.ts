import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { verifyAccessToken } from '../services/auth.service.js';
import { db } from '../db/connection.js';
import { tenants } from '../db/schema.js';
import {
  addConnection,
  removeConnection,
  subscribe,
  unsubscribe,
  getConnectionCountForTenant,
  getConnectionSubscriptions,
  getActiveConnectionCount as getActiveCount,
} from './fan-out.js';
import { WS_CONNECTION_LIMITS_BY_PLAN } from '@nexusfleet/shared';

// Valid channels that clients can subscribe to
const VALID_CHANNELS = new Set(['tracking', 'shipment_updates', 'alerts']);

/** Exported for testing: get subscriptions for a connection */
export { getConnectionSubscriptions };

/** Exported for testing: get total connection count */
export function getActiveConnectionCount(): number {
  return getActiveCount();
}

const HEARTBEAT_TIMEOUT_MS = 60_000;

export async function dashboardWs(app: FastifyInstance) {
  app.get('/dashboard', { websocket: true }, async (socket, request) => {
    const query = request.query as Record<string, string>;
    const token = query.token;

    if (!token) {
      socket.close(4001, 'Missing token');
      return;
    }

    let user: { sub: string; tid: string; role: string };
    try {
      user = verifyAccessToken(token);
    } catch {
      socket.close(4001, 'Invalid token');
      return;
    }

    // Look up tenant plan for connection limit enforcement
    let plan = 'free';
    try {
      const [tenant] = await db
        .select({ plan: tenants.plan })
        .from(tenants)
        .where(eq(tenants.id, user.tid))
        .limit(1);
      if (tenant?.plan) {
        plan = tenant.plan;
      }
    } catch (err) {
      request.log.error({ err }, 'Failed to look up tenant plan for WS limit');
    }

    // Enforce per-tenant WS connection limit
    const limit = WS_CONNECTION_LIMITS_BY_PLAN[plan] ?? WS_CONNECTION_LIMITS_BY_PLAN.free;
    const currentCount = getConnectionCountForTenant(user.tid);
    if (currentCount >= limit) {
      socket.close(4029, 'Connection limit exceeded');
      return;
    }

    // Generate unique connection ID
    const connectionId = crypto.randomUUID();

    // Register this connection for fan-out delivery
    addConnection(connectionId, socket, user.tid, user.sub);

    socket.send(JSON.stringify({ type: 'connected', data: { connection_id: connectionId, tenant_id: user.tid } }));

    // Heartbeat: close connection after 60s of silence
    let heartbeatTimer = setTimeout(() => {
      socket.close(4008, 'Heartbeat timeout');
    }, HEARTBEAT_TIMEOUT_MS);

    function resetHeartbeat() {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        socket.close(4008, 'Heartbeat timeout');
      }, HEARTBEAT_TIMEOUT_MS);
    }

    socket.on('message', (raw: Buffer) => {
      resetHeartbeat();

      let msg: { type?: string; channels?: string[]; channel?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        // Ignore malformed JSON
        return;
      }

      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', data: {} }));
        return;
      }

      if (msg.type === 'subscribe') {
        // Support both `channels` (array, per contract) and `channel` (string, fallback)
        const channels = msg.channels ?? (msg.channel ? [msg.channel] : []);
        const validChannels = channels.filter(
          (ch): ch is string => typeof ch === 'string' && VALID_CHANNELS.has(ch),
        );
        if (validChannels.length > 0) {
          subscribe(connectionId, validChannels);
        }
        return;
      }

      if (msg.type === 'unsubscribe') {
        // Support both `channels` (array, per contract) and `channel` (string, fallback)
        const channels = msg.channels ?? (msg.channel ? [msg.channel] : []);
        const validChannels = channels.filter(
          (ch): ch is string => typeof ch === 'string',
        );
        if (validChannels.length > 0) {
          unsubscribe(connectionId, validChannels);
        }
        return;
      }

      // Unknown message types are silently ignored
    });

    socket.on('close', () => {
      clearTimeout(heartbeatTimer);

      // Remove the connection — cleans up all subscriptions
      removeConnection(connectionId);
    });
  });
}
