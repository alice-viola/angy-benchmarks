import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useWebSocket, type WsStatus } from '../composables/useWebSocket';
import type { WsChannel } from '@nexus-fleet/shared';

export interface VehiclePosition {
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  timestamp: string;
}

export const useTrackingStore = defineStore('tracking', () => {
  const vehiclePositions = ref<Map<string, VehiclePosition>>(new Map());
  const connectionStatus = ref<WsStatus>('disconnected');
  const trackedVehicleId = ref<string | null>(null);

  const wsBaseUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  const { status, data, send, connect: wsConnect, disconnect: wsDisconnect } = useWebSocket(wsBaseUrl);

  watch(status, (val) => {
    connectionStatus.value = val;
  });

  watch(data, (msg) => {
    if (!msg || typeof msg !== 'object') return;
    const message = msg as Record<string, unknown>;
    if (message.channel === 'tracking' && message.type === 'location_update') {
      const payload = message.data as {
        vehicleId: string;
        lat: number;
        lng: number;
        speed?: number;
        heading?: number;
        timestamp: string;
      };
      vehiclePositions.value.set(payload.vehicleId, {
        lat: payload.lat,
        lng: payload.lng,
        speed_kmh: payload.speed ?? 0,
        heading: payload.heading ?? 0,
        timestamp: payload.timestamp,
      });
    }
  });

  function connect() {
    wsConnect();
  }

  function disconnect() {
    wsDisconnect();
    vehiclePositions.value.clear();
    trackedVehicleId.value = null;
  }

  function subscribe(channels: WsChannel[], entityIds?: string[]) {
    for (const channel of channels) {
      send({ action: 'subscribe', channel, entityIds });
    }
  }

  function trackVehicle(id: string) {
    trackedVehicleId.value = id;
    subscribe(['tracking'], [id]);
  }

  function stopTracking() {
    if (trackedVehicleId.value) {
      send({ action: 'unsubscribe', channel: 'tracking', entityIds: [trackedVehicleId.value] });
      trackedVehicleId.value = null;
    }
  }

  return {
    vehiclePositions,
    connectionStatus,
    trackedVehicleId,
    connect,
    disconnect,
    subscribe,
    trackVehicle,
    stopTracking,
  };
});
