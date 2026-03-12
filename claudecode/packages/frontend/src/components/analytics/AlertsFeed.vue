<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useApi } from '@/composables/useApi';
import { useWebSocket } from '@/composables/useWebSocket';
import type { GeofenceEvent } from '@/types';

const api = useApi();
const events = ref<GeofenceEvent[]>([]);
const loading = ref(true);
let wsCleanup: (() => void) | null = null;

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return date.toLocaleDateString();
}

onMounted(async () => {
  try {
    const response = await api.get<GeofenceEvent[]>('/geofences/events?limit=20');
    if (response.success) {
      events.value = response.data;
    }
  } finally {
    loading.value = false;
  }

  // Real-time updates
  const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws/dashboard`;
  const ws = useWebSocket({ url: wsUrl });
  ws.subscribe(['geofence_events']);

  ws.onMessage('geofence_event', (data: GeofenceEvent) => {
    events.value.unshift(data);
    if (events.value.length > 50) {
      events.value.pop();
    }
  });

  wsCleanup = () => ws.close();
});

onUnmounted(() => {
  wsCleanup?.();
});
</script>

<template>
  <div class="card">
    <h3 class="text-sm font-semibold text-gray-900 mb-4">Recent Geofence Alerts</h3>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="flex items-center gap-3">
        <div class="skeleton h-8 w-8 rounded-full" />
        <div class="flex-1 space-y-1">
          <div class="skeleton h-3 w-3/4 rounded" />
          <div class="skeleton h-2 w-1/2 rounded" />
        </div>
      </div>
    </div>

    <div v-else class="max-h-80 overflow-y-auto space-y-1">
      <div
        v-for="event in events"
        :key="event.id"
        class="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50"
      >
        <div
          :class="[
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
            event.event_type === 'enter'
              ? 'bg-success-100 text-success-600'
              : 'bg-warning-100 text-warning-600',
          ]"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path
              v-if="event.event_type === 'enter'"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
            />
            <path
              v-else
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-sm text-gray-900">
            <span class="font-medium">{{ event.vehicle_registration || event.vehicle_id.slice(0, 8) }}</span>
            {{ event.event_type === 'enter' ? 'entered' : 'exited' }}
            <span class="font-medium">{{ event.geofence_name }}</span>
          </p>
          <p class="text-xs text-gray-500">{{ formatTime(event.created_at) }}</p>
        </div>
      </div>

      <div v-if="events.length === 0" class="py-8 text-center text-sm text-gray-500">
        No geofence alerts yet.
      </div>
    </div>
  </div>
</template>
