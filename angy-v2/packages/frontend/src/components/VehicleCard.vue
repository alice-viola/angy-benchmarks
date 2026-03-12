<script setup lang="ts">
import { computed } from 'vue';
import { Truck, MapPin, Gauge, ChevronRight } from 'lucide-vue-next';
import StatusBadge from './common/StatusBadge.vue';
import type { VehicleResponse } from '@nexusfleet/shared';

const props = defineProps<{
  vehicle: VehicleResponse;
}>();

const emit = defineEmits<{
  click: [vehicle: VehicleResponse];
}>();

const vehicleTitle = computed(
  () => `${props.vehicle.make} ${props.vehicle.model}`
);

const locationDisplay = computed(() => {
  if (!props.vehicle.last_location) return null;
  return `${props.vehicle.last_location.lat.toFixed(4)}, ${props.vehicle.last_location.lng.toFixed(4)}`;
});

const typeIcon = computed(() => {
  // All vehicle types use Truck icon
  return Truck;
});

const typeColorClass = computed(() => {
  const map: Record<string, string> = {
    van: 'bg-info-50 text-info-500',
    truck: 'bg-primary-50 text-primary-500',
    semi: 'bg-accent-50 text-accent-600',
    refrigerated: 'bg-success-50 text-success-500',
  };
  return map[props.vehicle.type] || 'bg-neutral-100 text-neutral-500';
});
</script>

<template>
  <div
    class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer group"
    @click="emit('click', vehicle)"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <div :class="['w-10 h-10 rounded-xl flex items-center justify-center', typeColorClass]">
          <component :is="typeIcon" class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-medium text-neutral-800">{{ vehicleTitle }}</h3>
          <p class="text-xs text-neutral-400 font-mono">{{ vehicle.registration }}</p>
        </div>
      </div>
      <StatusBadge :status="vehicle.status" />
    </div>

    <div class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-neutral-500">
        <Truck class="w-3.5 h-3.5 text-neutral-400" />
        <span class="capitalize">{{ vehicle.type }}</span>
        <span class="text-neutral-300">·</span>
        <span>{{ vehicle.year }}</span>
      </div>

      <div v-if="locationDisplay" class="flex items-center gap-2 text-xs text-neutral-500">
        <MapPin class="w-3.5 h-3.5 text-neutral-400" />
        <span>{{ locationDisplay }}</span>
      </div>

      <div v-if="vehicle.last_speed_kmh != null" class="flex items-center gap-2 text-xs text-neutral-500">
        <Gauge class="w-3.5 h-3.5 text-neutral-400" />
        <span>{{ vehicle.last_speed_kmh }} km/h</span>
      </div>
    </div>

    <div class="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
      <div class="flex gap-4 text-xs text-neutral-400">
        <span>{{ vehicle.capacity_kg }} kg</span>
        <span>{{ vehicle.capacity_m3 }} m³</span>
      </div>
      <ChevronRight class="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
    </div>
  </div>
</template>
