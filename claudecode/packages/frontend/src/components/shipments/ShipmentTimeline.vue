<script setup lang="ts">
import { onMounted } from 'vue';
import { useShipmentsStore } from '@/stores/shipments';
import StatusBadge from '@/components/common/StatusBadge.vue';

const props = defineProps<{
  shipmentId: string;
}>();

const shipmentsStore = useShipmentsStore();

const eventIcons: Record<string, { icon: string; color: string }> = {
  created: {
    icon: 'M12 4v16m8-8H4',
    color: 'bg-blue-500',
  },
  confirmed: {
    icon: 'M5 13l4 4L19 7',
    color: 'bg-blue-500',
  },
  assigned: {
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    color: 'bg-indigo-500',
  },
  picked_up: {
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8',
    color: 'bg-purple-500',
  },
  in_transit: {
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: 'bg-accent-500',
  },
  delivered: {
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'bg-success-500',
  },
  completed: {
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'bg-success-500',
  },
  failed: {
    icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'bg-danger-500',
  },
  cancelled: {
    icon: 'M6 18L18 6M6 6l12 12',
    color: 'bg-danger-500',
  },
  status_change: {
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    color: 'bg-blue-500',
  },
  note: {
    icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
    color: 'bg-gray-500',
  },
};

function getEventStyle(eventType: string) {
  return eventIcons[eventType] || eventIcons.note;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function getTimelineColor(eventType: string): string {
  if (['delivered', 'completed'].includes(eventType)) return 'border-success-300';
  if (['failed', 'cancelled'].includes(eventType)) return 'border-danger-300';
  return 'border-blue-300';
}

onMounted(() => {
  shipmentsStore.fetchEvents(props.shipmentId);
});
</script>

<template>
  <div class="flow-root">
    <ul class="-mb-8">
      <li
        v-for="(event, index) in shipmentsStore.events"
        :key="event.id"
        class="relative pb-8"
      >
        <!-- Connecting line -->
        <span
          v-if="index !== shipmentsStore.events.length - 1"
          :class="[
            'absolute left-4 top-8 -ml-px h-full w-0.5 border-l-2 border-dashed',
            getTimelineColor(event.event_type),
          ]"
        />

        <div class="relative flex items-start gap-4">
          <!-- Icon -->
          <div
            :class="[
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white',
              getEventStyle(event.event_type).color,
            ]"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" :d="getEventStyle(event.event_type).icon" />
            </svg>
          </div>

          <!-- Content -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium text-gray-900">
                {{ event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) }}
              </p>
              <StatusBadge v-if="event.to_status" :status="event.to_status" type="shipment" />
            </div>

            <div class="mt-1 flex items-center gap-3 text-xs text-gray-500">
              <span>{{ formatTime(event.created_at) }}</span>
              <span v-if="event.user_name">by {{ event.user_name }}</span>
            </div>

            <p v-if="event.notes" class="mt-1 text-sm text-gray-600">
              {{ event.notes }}
            </p>

            <div v-if="event.from_status && event.to_status" class="mt-1 flex items-center gap-1 text-xs text-gray-400">
              <StatusBadge :status="event.from_status" type="shipment" />
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <StatusBadge :status="event.to_status" type="shipment" />
            </div>
          </div>
        </div>
      </li>
    </ul>

    <div v-if="shipmentsStore.events.length === 0" class="py-8 text-center text-sm text-gray-500">
      No events recorded yet.
    </div>
  </div>
</template>
