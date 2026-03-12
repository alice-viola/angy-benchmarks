import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useWebSocket, type ConnectionStatus } from '@/composables/useWebSocket';
import type { VehicleLocation } from '@nexus-fleet/shared';

export const useTrackingStore = defineStore('tracking', () => {
  const vehiclePositions = ref<Map<string, VehicleLocation>>(new Map());
  const connectionStatus = ref<ConnectionStatus>('disconnected');
  let wsInstance: ReturnType<typeof useWebSocket> | null = null;

  function connect() {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws/dashboard`;

    wsInstance = useWebSocket({
      url: wsUrl,
      autoConnect: true,
    });

    // Sync connection status
    const checkStatus = setInterval(() => {
      if (wsInstance) {
        connectionStatus.value = wsInstance.status.value;
      }
    }, 500);

    wsInstance.subscribe(['tracking']);

    wsInstance.onMessage('vehicle_location', (data: VehicleLocation) => {
      vehiclePositions.value.set(data.vehicle_id, data);
    });

    wsInstance.onMessage('vehicle_locations_batch', (data: VehicleLocation[]) => {
      data.forEach((loc) => {
        vehiclePositions.value.set(loc.vehicle_id, loc);
      });
    });

    return () => {
      clearInterval(checkStatus);
      wsInstance?.close();
    };
  }

  function disconnect() {
    wsInstance?.close();
    wsInstance = null;
    connectionStatus.value = 'disconnected';
  }

  const vehicleList = computed(() => Array.from(vehiclePositions.value.values()));
  const vehicleCount = computed(() => vehiclePositions.value.size);

  function getVehiclePosition(vehicleId: string): VehicleLocation | undefined {
    return vehiclePositions.value.get(vehicleId);
  }

  return {
    vehiclePositions,
    connectionStatus,
    vehicleList,
    vehicleCount,
    connect,
    disconnect,
    getVehiclePosition,
  };
});
