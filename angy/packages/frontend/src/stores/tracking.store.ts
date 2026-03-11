import { defineStore } from 'pinia';
import { ref, computed, onUnmounted } from 'vue';
import { useWebSocket } from '@/composables/useWebSocket';

export interface VehiclePosition {
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  timestamp: string;
}

export const useTrackingStore = defineStore('tracking', () => {
  const positions = ref<Map<string, VehiclePosition>>(new Map());
  const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:3000'}/ws/dashboard`;
  const { status, connected, onMessage, send } = useWebSocket(wsUrl);

  send({ type: 'subscribe', channel: 'tracking' });

  onMessage((data: unknown) => {
    const msg = data as { channel?: string; type?: string; payload?: unknown };
    if (msg.channel === 'tracking' && msg.payload) {
      const p = msg.payload as {
        vehicle_id: string;
        lat: number;
        lng: number;
        speed_kmh: number;
        heading: number;
        timestamp: string;
      };
      const updated = new Map(positions.value);
      updated.set(p.vehicle_id, {
        lat: p.lat,
        lng: p.lng,
        speed_kmh: p.speed_kmh,
        heading: p.heading,
        timestamp: p.timestamp,
      });
      positions.value = updated;
    }
  });

  const vehicleIds = computed(() => Array.from(positions.value.keys()));

  function getPosition(vehicleId: string): VehiclePosition | undefined {
    return positions.value.get(vehicleId);
  }

  return {
    positions,
    vehicleIds,
    status,
    connected,
    getPosition,
  };
});
