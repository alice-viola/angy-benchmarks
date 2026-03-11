<script setup lang="ts">
import { ref } from 'vue';
import { useWebSocket } from '@/composables/useWebSocket';

interface Alert {
  id: string;
  geofence_name: string;
  vehicle_registration: string;
  event_type: 'enter' | 'exit';
  timestamp: string;
}

const alerts = ref<Alert[]>([]);
const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:3000'}/ws/dashboard`;
const { onMessage, send } = useWebSocket(wsUrl);

send({ type: 'subscribe', channel: 'alerts' });

onMessage((data: unknown) => {
  const msg = data as { channel?: string; type?: string; payload?: unknown };
  if (msg.channel === 'alerts' && msg.payload) {
    const alert = msg.payload as Alert;
    alerts.value.unshift(alert);
    if (alerts.value.length > 20) alerts.value.pop();
  }
});

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
</script>

<template>
  <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
    <h3 class="text-sm font-medium text-slate-700 mb-3">Live Alerts</h3>
    <div class="max-h-96 overflow-y-auto space-y-2">
      <div
        v-if="alerts.length === 0"
        class="text-sm text-slate-400 text-center py-4"
      >
        No alerts yet
      </div>
      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="flex items-center justify-between p-2 rounded bg-slate-50 text-sm"
      >
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            :class="
              alert.event_type === 'enter'
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
            "
          >
            {{ alert.event_type }}
          </span>
          <span class="text-slate-700">{{ alert.vehicle_registration }}</span>
          <span class="text-slate-400">@</span>
          <span class="text-slate-600">{{ alert.geofence_name }}</span>
        </div>
        <span class="text-xs text-slate-400">{{ timeAgo(alert.timestamp) }}</span>
      </div>
    </div>
  </div>
</template>
