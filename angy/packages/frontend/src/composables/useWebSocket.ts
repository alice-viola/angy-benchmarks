import { ref, onUnmounted } from 'vue';

export type WsStatus = 'connected' | 'reconnecting' | 'disconnected';
type MessageHandler = (data: unknown) => void;

export function useWebSocket(wsUrl: string) {
  const status = ref<WsStatus>('disconnected');
  const connected = ref(false);
  const reconnecting = ref(false);
  const disconnected = ref(true);

  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const handlers: MessageHandler[] = [];
  const messageQueue: unknown[] = [];

  function setStatus(s: WsStatus) {
    status.value = s;
    connected.value = s === 'connected';
    reconnecting.value = s === 'reconnecting';
    disconnected.value = s === 'disconnected';
  }

  function getBackoff() {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    return delay;
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (pongTimer) clearTimeout(pongTimer);
    heartbeatTimer = null;
    pongTimer = null;
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        pongTimer = setTimeout(() => {
          // No pong received, reconnect
          ws?.close();
        }, 5000);
      }
    }, 30000);
  }

  function flushQueue() {
    while (messageQueue.length > 0 && ws?.readyState === WebSocket.OPEN) {
      const msg = messageQueue.shift();
      ws.send(JSON.stringify(msg));
    }
  }

  function connect() {
    if (destroyed) return;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttempts = 0;
      startHeartbeat();
      flushQueue();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'pong') {
          if (pongTimer) clearTimeout(pongTimer);
          pongTimer = null;
          return;
        }
        handlers.forEach((h) => h(data));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      if (destroyed) {
        setStatus('disconnected');
        return;
      }
      setStatus('reconnecting');
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function scheduleReconnect() {
    if (destroyed) return;
    const delay = getBackoff();
    reconnectAttempts++;
    reconnectTimer = setTimeout(() => connect(), delay);
  }

  function send(msg: unknown) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      messageQueue.push(msg);
    }
  }

  function onMessage(handler: MessageHandler) {
    handlers.push(handler);
  }

  function close() {
    destroyed = true;
    stopHeartbeat();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
    setStatus('disconnected');
  }

  connect();

  onUnmounted(() => {
    close();
  });

  return {
    status,
    connected,
    reconnecting,
    disconnected,
    send,
    onMessage,
    close,
  };
}
