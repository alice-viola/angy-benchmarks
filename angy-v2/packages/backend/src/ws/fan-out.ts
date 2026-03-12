import { Redis } from 'ioredis';

interface DashboardConnection {
  socket: { readyState: number; send(data: string): void };
  tenant_id: string;
  user_id: string;
  subscriptions: Set<string>;
}

/** All active dashboard connections keyed by connectionId */
const connections = new Map<string, DashboardConnection>();

/** Redis channel patterns to subscribe to */
const CHANNEL_PATTERNS = ['tracking:*', 'shipment_updates:*', 'alerts:*'];

/**
 * Extract the base channel name and tenant ID from a Redis channel.
 * E.g. "tracking:abc-123" → { baseName: "tracking", tenantId: "abc-123" }
 */
function extractChannelInfo(
  redisChannel: string,
): { baseName: string; tenantId: string } | null {
  const idx = redisChannel.indexOf(':');
  if (idx === -1) return null;
  return {
    baseName: redisChannel.substring(0, idx),
    tenantId: redisChannel.substring(idx + 1),
  };
}

let subscriber: Redis | null = null;

/**
 * Start the Redis subscriber and wire the pmessage listener.
 * Messages received on subscribed patterns are forwarded to
 * dashboard WS connections whose subscription set includes
 * the matching base channel and whose tenant matches.
 */
export function initFanOut(): void {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  subscriber = new Redis(url, { maxRetriesPerRequest: null });

  subscriber.psubscribe(...CHANNEL_PATTERNS).catch((err) => {
    // Log but don't crash — reconnect logic in ioredis will retry
    console.error('Failed to psubscribe to fan-out channels', err);
  });

  subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
    const info = extractChannelInfo(channel);
    if (!info) return;

    for (const conn of connections.values()) {
      if (
        conn.tenant_id === info.tenantId &&
        conn.subscriptions.has(info.baseName) &&
        conn.socket.readyState === 1
      ) {
        conn.socket.send(message);
      }
    }
  });
}

/** Register a new dashboard connection for fan-out delivery. */
export function addConnection(
  id: string,
  socket: DashboardConnection['socket'],
  tenant_id: string,
  user_id: string,
): void {
  connections.set(id, { socket, tenant_id, user_id, subscriptions: new Set() });
}

/** Remove a dashboard connection (called on WS close). */
export function removeConnection(id: string): void {
  connections.delete(id);
}

/** Add channels to a connection's subscription set. */
export function subscribe(connectionId: string, channels: string[]): void {
  const conn = connections.get(connectionId);
  if (!conn) return;
  for (const ch of channels) {
    conn.subscriptions.add(ch);
  }
}

/** Remove channels from a connection's subscription set. */
export function unsubscribe(connectionId: string, channels: string[]): void {
  const conn = connections.get(connectionId);
  if (!conn) return;
  for (const ch of channels) {
    conn.subscriptions.delete(ch);
  }
}

/** Count active dashboard connections for a given tenant. */
export function getConnectionCountForTenant(tenantId: string): number {
  let count = 0;
  for (const conn of connections.values()) {
    if (conn.tenant_id === tenantId) count++;
  }
  return count;
}

/** Get the subscription set for a connection (used in tests). */
export function getConnectionSubscriptions(
  connectionId: string,
): Set<string> | undefined {
  return connections.get(connectionId)?.subscriptions;
}

/** Get total number of active dashboard connections (used in tests). */
export function getActiveConnectionCount(): number {
  return connections.size;
}
