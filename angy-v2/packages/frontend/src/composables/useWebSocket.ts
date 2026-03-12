import { ref, onUnmounted, type Ref } from 'vue';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface UseWebSocketOptions {
  onMessage?: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  autoConnect?: boolean;
}

export function useWebSocket(url: string | Ref<string>, options: UseWebSocketOptions = {}) {
  const connectionStatus = ref<ConnectionStatus>('disconnected');
  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  let messageQueue: string[] = [];
  let isClosedManually = false;

  const MAX_RECONNECT_DELAY = 30000;

  function getReconnectDelay(): number {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
    return delay;
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        pongTimer = setTimeout(() => {
          // No pong received in 5s
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

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    isClosedManually = false;
    const wsUrl = typeof url === 'string' ? url : url.value;

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      connectionStatus.value = 'disconnected';
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      connectionStatus.value = 'connected';
      reconnectAttempt = 0;
      startHeartbeat();
      options.onOpen?.();

      // Replay queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift()!;
        ws!.send(msg);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle pong to clear timer
        if (data.type === 'pong') {
          if (pongTimer) {
            clearTimeout(pongTimer);
            pongTimer = null;
          }
          return;
        }
        options.onMessage?.(data);
      } catch {
        // Non-JSON message, ignore
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      options.onClose?.();
      if (!isClosedManually) {
        connectionStatus.value = 'reconnecting';
        scheduleReconnect();
      } else {
        connectionStatus.value = 'disconnected';
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  function scheduleReconnect() {
    if (isClosedManually) return;
    const delay = getReconnectDelay();
    reconnectAttempt++;
    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  function send(msg: unknown) {
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      messageQueue.push(data);
    }
  }

  function close() {
    isClosedManually = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopHeartbeat();
    ws?.close();
    ws = null;
    connectionStatus.value = 'disconnected';
  }

  if (options.autoConnect !== false) {
    connect();
  }

  onUnmounted(() => {
    close();
  });

  return {
    connectionStatus,
    send,
    close,
    connect,
  };
}
