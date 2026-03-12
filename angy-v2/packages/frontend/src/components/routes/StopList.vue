<script setup lang="ts">
import { MapPin, GripVertical, Package, Warehouse } from 'lucide-vue-next';
import StatusBadge from '../common/StatusBadge.vue';

export interface Stop {
  id: string;
  shipment_id: string | null;
  stop_type: string;
  sequence_order: number;
  location: { lat: number; lng: number };
  address: string;
  planned_arrival: string | null;
  actual_arrival: string | null;
  status: string;
}

defineProps<{
  stops: Stop[];
}>();

const emit = defineEmits<{
  'select-stop': [stop: Stop];
}>();

const stopIcons: Record<string, typeof MapPin> = {
  pickup: Package,
  delivery: MapPin,
  depot: Warehouse,
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="stop in stops"
      :key="stop.id"
      class="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer transition-colors"
      @click="emit('select-stop', stop)"
    >
      <GripVertical class="w-4 h-4 text-neutral-300 mt-0.5 flex-shrink-0" />
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        :class="stop.stop_type === 'pickup' ? 'bg-accent-50 text-accent-500' : stop.stop_type === 'depot' ? 'bg-neutral-100 text-neutral-500' : 'bg-primary-50 text-primary-500'"
      >
        <component :is="stopIcons[stop.stop_type] || MapPin" class="w-4 h-4" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-neutral-500 uppercase">{{ stop.stop_type }} #{{ stop.sequence_order + 1 }}</span>
          <StatusBadge :status="stop.status" />
        </div>
        <p class="text-sm text-neutral-700 mt-0.5 truncate">{{ stop.address }}</p>
        <p class="text-xs text-neutral-400 mt-0.5">ETA: {{ formatTime(stop.planned_arrival) }}</p>
      </div>
    </div>

    <div v-if="!stops.length" class="text-center py-8">
      <MapPin class="w-8 h-8 text-neutral-300 mx-auto mb-2" />
      <p class="text-sm text-neutral-400">No stops added yet</p>
    </div>
  </div>
</template>
