import { ref, type Ref } from 'vue';

export type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

const MAX_BACKOFF_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 5_000;

export interface UseWebSocketReturn {
  status: Ref<WsStatus>;
  data: Ref<unknown>;
  send: (payload: unknown) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(
  url: string,
  options: { autoConnect?: boolean } = {},
): UseWebSocketReturn {
  const status = ref<WsStatus>('disconnected');
  const data: Ref<unknown> = ref(null);

  let ws: WebSocket | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;
  const messageQueue: unknown[] = [];

  function getAuthUrl(): string {
    const token = localStorage.getItem('access_token');
    const separator = url.includes('?') ? '&' : '?';
    return token ? `${url}${separator}token=${encodeURIComponent(token)}` : url;
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        pongTimer = setTimeout(() => {
          ws?.close();
        }, PONG_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
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
      ws.send(JSON.stringify(messageQueue.shift()));
    }
  }

  function scheduleReconnect() {
    if (intentionalClose) return;
    status.value = 'reconnecting';
    const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF_MS);
    retryCount++;
    retryTimer = setTimeout(() => connect(), delay);
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    intentionalClose = false;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    ws = new WebSocket(getAuthUrl());

    ws.onopen = () => {
      status.value = 'connected';
      retryCount = 0;
      startHeartbeat();
      flushQueue();
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data as string);
        if (parsed.type === 'pong') {
          if (pongTimer) {
            clearTimeout(pongTimer);
            pongTimer = null;
          }
          return;
        }
        data.value = parsed;
      } catch {
        data.value = event.data;
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      if (!intentionalClose) {
        scheduleReconnect();
      } else {
        status.value = 'disconnected';
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function disconnect() {
    intentionalClose = true;
    stopHeartbeat();
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    ws?.close();
    ws = null;
    status.value = 'disconnected';
  }

  function send(payload: unknown) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      messageQueue.push(payload);
    }
  }

  if (options.autoConnect) {
    connect();
  }

  return { status, data, send, connect, disconnect };
}
