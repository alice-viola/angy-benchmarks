<script setup lang="ts">
import type { ShipmentEventResponse } from '@nexusfleet/shared';
import { Clock, ArrowRight } from 'lucide-vue-next';

defineProps<{
  events: ShipmentEventResponse[];
}>();

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="space-y-0">
    <div
      v-for="(event, idx) in events"
      :key="event.id"
      class="relative flex gap-4 pb-6"
    >
      <!-- Timeline line -->
      <div class="flex flex-col items-center">
        <div class="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0 z-10">
          <Clock class="w-4 h-4 text-primary-500" />
        </div>
        <div
          v-if="idx < events.length - 1"
          class="w-px flex-1 bg-neutral-200 mt-1"
        />
      </div>

      <!-- Content -->
      <div class="pt-1 pb-1 min-w-0">
        <p class="text-sm font-medium text-neutral-800 capitalize">
          {{ event.event_type.replace(/_/g, ' ') }}
        </p>
        <div v-if="event.from_status && event.to_status" class="flex items-center gap-1.5 mt-0.5">
          <span class="text-xs text-neutral-400 capitalize">{{ event.from_status.replace(/_/g, ' ') }}</span>
          <ArrowRight class="w-3 h-3 text-neutral-300" />
          <span class="text-xs font-medium text-neutral-600 capitalize">{{ event.to_status.replace(/_/g, ' ') }}</span>
        </div>
        <p v-if="event.notes" class="text-xs text-neutral-500 mt-1">{{ event.notes }}</p>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs text-neutral-400">{{ formatDateTime(event.created_at) }}</span>
          <span v-if="event.created_by" class="text-xs text-neutral-400">
            by {{ event.created_by.first_name }} {{ event.created_by.last_name }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="!events.length" class="text-center py-8">
      <Clock class="w-8 h-8 text-neutral-300 mx-auto mb-2" />
      <p class="text-sm text-neutral-400">No events recorded yet</p>
    </div>
  </div>
</template>
