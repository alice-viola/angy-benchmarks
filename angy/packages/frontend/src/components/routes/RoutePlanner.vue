<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouteStore, type Route } from '@/stores/route.store';
import StopList from './StopList.vue';
import CargoCapacityBar from './CargoCapacityBar.vue';

const props = defineProps<{
  route: Route;
}>();

const emit = defineEmits<{
  'update:stops': [stops: Route['stops']];
}>();

const routeStore = useRouteStore();
const optimizing = computed(() => routeStore.optimizeJob?.status === 'waiting' || routeStore.optimizeJob?.status === 'active');

const totalWeight = computed(() => {
  if (!props.route.stops) return 0;
  return props.route.stops.reduce((sum, s) => sum + (s.shipment?.reference_code ? 10 : 0), 0);
});

const vehicleCapacity = computed(() => Number(props.route.vehicle?.capacity_kg) || 0);

async function handleOptimize() {
  await routeStore.optimize(props.route.id);
}

function onStopsReorder(stops: Route['stops']) {
  emit('update:stops', stops);
}
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-slate-900">Route Planner</h3>
      <button
        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        :disabled="optimizing"
        @click="handleOptimize"
      >
        {{ optimizing ? 'Optimizing...' : 'Optimize' }}
      </button>
    </div>

    <CargoCapacityBar
      v-if="vehicleCapacity > 0"
      :current="totalWeight"
      :max="vehicleCapacity"
    />

    <StopList
      :stops="route.stops ?? []"
      @update:stops="onStopsReorder"
    />
  </div>
</template>
