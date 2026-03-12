<script setup lang="ts">
import { computed } from 'vue';
import { LogIn, LogOut, Radar, Bell } from 'lucide-vue-next';
import LoadingSkeleton from '../common/LoadingSkeleton.vue';

interface GeofenceAlert {
  id: string;
  geofence_id?: string;
  geofence_name?: string;
  vehicle_id?: string;
  vehicle_registration?: string;
  event_type: 'enter' | 'exit' | string;
  location?: { lat: number; lng: number };
  triggered_at: string;
  // Also supports notification shape
  type?: string;
  title?: string;
  body?: string;
  created_at?: string;
}

const props = defineProps<{
  alerts: GeofenceAlert[];
  loading?: boolean;
}>();

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const eventIcon = (alert: GeofenceAlert) => {
  if (alert.event_type === 'enter') return LogIn;
  if (alert.event_type === 'exit') return LogOut;
  return Bell;
};

const eventColor = (alert: GeofenceAlert) => {
  if (alert.event_type === 'enter') return {
    bg: 'bg-info-50',
    text: 'text-info-500',
    dot: 'bg-info-500',
  };
  if (alert.event_type === 'exit') return {
    bg: 'bg-warning-50',
    text: 'text-warning-500',
    dot: 'bg-warning-500',
  };
  return {
    bg: 'bg-neutral-100',
    text: 'text-neutral-500',
    dot: 'bg-neutral-400',
  };
};

const hasAlerts = computed(() => props.alerts.length > 0);
</script>

<template>
  <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-medium text-neutral-800">Recent Alerts</h2>
      <span class="text-xs text-neutral-400">{{ alerts.length }} alerts</span>
    </div>

    <template v-if="loading">
      <div class="space-y-3">
        <div v-for="i in 5" :key="i" class="flex items-start gap-3">
          <LoadingSkeleton width="32px" height="32px" rounded="rounded-lg" />
          <div class="flex-1">
            <LoadingSkeleton width="80%" height="12px" class="mb-2" />
            <LoadingSkeleton width="50%" height="10px" />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="!hasAlerts">
      <div class="flex flex-col items-center justify-center py-10">
        <div class="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
          <Radar class="w-6 h-6 text-neutral-300" />
        </div>
        <p class="text-sm text-neutral-500">No recent alerts</p>
        <p class="text-xs text-neutral-400 mt-1">Geofence events will appear here</p>
      </div>
    </template>

    <template v-else>
      <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
        <div
          v-for="alert in alerts"
          :key="alert.id"
          class="flex items-start gap-3 p-2.5 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          <div
            :class="[
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              eventColor(alert).bg,
            ]"
          >
            <component
              :is="eventIcon(alert)"
              :class="['w-4 h-4', eventColor(alert).text]"
            />
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-neutral-700 truncate">
              <template v-if="alert.title">
                {{ alert.title }}
              </template>
              <template v-else>
                <span class="capitalize">{{ alert.event_type }}</span>
                <template v-if="alert.geofence_name">
                  · {{ alert.geofence_name }}
                </template>
              </template>
            </p>
            <p class="text-xs text-neutral-400 mt-0.5 truncate">
              <template v-if="alert.body">
                {{ alert.body }}
              </template>
              <template v-else-if="alert.vehicle_registration">
                {{ alert.vehicle_registration }}
              </template>
            </p>
          </div>

          <span class="text-xs text-neutral-400 flex-shrink-0 mt-0.5">
            {{ formatDate(alert.triggered_at || alert.created_at || '') }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
