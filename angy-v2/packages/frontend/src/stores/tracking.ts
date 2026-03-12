import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useWebSocket, type ConnectionStatus } from '../composables/useWebSocket';
import { useAuthStore } from './auth';

export interface VehicleLocation {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  timestamp: string;
}

export const useTrackingStore = defineStore('tracking', () => {
  const vehiclePositions = ref<Map<string, VehicleLocation>>(new Map());
  const connectionStatus = ref<ConnectionStatus>('disconnected');

  let wsSend: ((msg: unknown) => void) | null = null;
  let wsClose: (() => void) | null = null;

  function connect() {
    const authStore = useAuthStore();
    if (!authStore.accessToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/dashboard?token=${authStore.accessToken}`;

    const { send, close, connectionStatus: status } = useWebSocket(wsUrl, {
      onMessage: (data: unknown) => {
        const msg = data as { type: string; data: Record<string, unknown> };
        if (msg.type === 'vehicle_location') {
          const loc = msg.data as unknown as VehicleLocation;
          vehiclePositions.value.set(loc.vehicle_id, loc);
        }
      },
      onOpen: () => {
        // Subscribe to tracking channel
        send({ type: 'subscribe', channels: ['tracking', 'shipment_updates', 'alerts'] });
      },
    });

    wsSend = send;
    wsClose = close;

    // Sync status reactively
    const stopWatch = setInterval(() => {
      connectionStatus.value = status.value;
    }, 500);

    // Store cleanup ref
    (connect as { _stopWatch?: ReturnType<typeof setInterval> })._stopWatch = stopWatch;
  }

  function disconnect() {
    wsClose?.();
    const stopWatch = (connect as { _stopWatch?: ReturnType<typeof setInterval> })._stopWatch;
    if (stopWatch) clearInterval(stopWatch);
  }

  function send(msg: unknown) {
    wsSend?.(msg);
  }

  const vehiclePositionsList = computed(() => Array.from(vehiclePositions.value.values()));

  return {
    vehiclePositions,
    connectionStatus,
    vehiclePositionsList,
    connect,
    disconnect,
    send,
  };
});
