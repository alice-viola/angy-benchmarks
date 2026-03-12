import { ref, type Ref } from 'vue';
import { getAccessToken } from './useApi';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const status: Ref<ConnectionStatus> = ref('disconnected');
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  const messageQueue: string[] = [];
  const handlers = new Map<string, Set<Function>>();

  function getBackoffDelay(): number {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    return delay;
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        pongTimer = setTimeout(() => {
          ws?.close();
        }, 5000);
      }
    }, 30000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (pongTimer) {
      clearTimeout(pongTimer);
      pongTimer = null;
    }
  }

  function flushQueue() {
    while (messageQueue.length > 0 && ws?.readyState === WebSocket.OPEN) {
      const msg = messageQueue.shift()!;
      ws.send(msg);
    }
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = getAccessToken();
    const wsUrl = token
      ? `${options.url}?token=${encodeURIComponent(token)}`
      : options.url;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      status.value = 'connected';
      reconnectAttempts = 0;
      startHeartbeat();
      flushQueue();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'pong') {
          if (pongTimer) {
            clearTimeout(pongTimer);
            pongTimer = null;
          }
          return;
        }

        const typeHandlers = handlers.get(message.type);
        if (typeHandlers) {
          typeHandlers.forEach((handler) => handler(message.data, message));
        }

        const wildcardHandlers = handlers.get('*');
        if (wildcardHandlers) {
          wildcardHandlers.forEach((handler) => handler(message.data, message));
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      if (status.value !== 'disconnected') {
        status.value = 'reconnecting';
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;

    const delay = getBackoffDelay();
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function subscribe(channels: string[]) {
    const msg = JSON.stringify({ type: 'subscribe', data: { channels } });
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(msg);
    } else {
      messageQueue.push(msg);
    }
  }

  function send(type: string, data?: unknown) {
    const msg = JSON.stringify({ type, data });
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(msg);
    } else {
      messageQueue.push(msg);
    }
  }

  function onMessage(type: string, handler: Function) {
    if (!handlers.has(type)) {
      handlers.set(type, new Set());
    }
    handlers.get(type)!.add(handler);

    return () => {
      handlers.get(type)?.delete(handler);
    };
  }

  function close() {
    status.value = 'disconnected';
    stopHeartbeat();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
  }

  if (options.autoConnect !== false) {
    connect();
  }

  return {
    status,
    connect,
    close,
    subscribe,
    send,
    onMessage,
  };
}
