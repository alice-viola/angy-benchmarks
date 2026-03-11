<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import StatusBadge from '@/components/common/StatusBadge.vue';
import LiveMap from '@/components/map/LiveMap.vue';
import { useVehicleStore } from '@/stores/vehicle.store';

const route = useRoute();
const store = useVehicleStore();
const id = route.params.id as string;

onMounted(() => {
  store.fetchOne(id);
});

const hasLocation = computed(() =>
  store.currentVehicle?.last_latitude != null && store.currentVehicle?.last_longitude != null
);

const mapCenter = computed<[number, number]>(() => {
  if (hasLocation.value && store.currentVehicle) {
    return [store.currentVehicle.last_latitude!, store.currentVehicle.last_longitude!];
  }
  return [40, -95];
});
</script>

<template>
  <div v-if="store.currentVehicle">
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-slate-900">{{ store.currentVehicle.registration }}</h1>
      <StatusBadge :status="store.currentVehicle.status" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">Vehicle Details</h3>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Make/Model</dt>
            <dd class="text-slate-900">{{ store.currentVehicle.make }} {{ store.currentVehicle.model }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Year</dt>
            <dd class="text-slate-900">{{ store.currentVehicle.year }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Type</dt>
            <dd class="text-slate-900 capitalize">{{ store.currentVehicle.type }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Max Weight</dt>
            <dd class="text-slate-900">{{ store.currentVehicle.capacity_kg ?? '-' }} kg</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Max Volume</dt>
            <dd class="text-slate-900">{{ store.currentVehicle.capacity_m3 ?? '-' }} m³</dd>
          </div>
        </dl>
      </div>

      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">Assigned Driver</h3>
        <div v-if="store.currentVehicle.driver" class="text-sm">
          <p class="text-slate-900 font-medium">
            {{ store.currentVehicle.driver.first_name }} {{ store.currentVehicle.driver.last_name }}
          </p>
        </div>
        <p v-else class="text-sm text-slate-400">No driver assigned</p>
      </div>

      <div v-if="hasLocation" class="lg:col-span-2">
        <LiveMap :center="mapCenter" :zoom="13" height="300px" :show-vehicles="false" />
      </div>
    </div>
  </div>
  <div v-else-if="store.loading" class="animate-pulse space-y-4">
    <div class="h-8 bg-slate-200 rounded w-1/3"></div>
    <div class="h-64 bg-slate-200 rounded"></div>
  </div>
</template>
