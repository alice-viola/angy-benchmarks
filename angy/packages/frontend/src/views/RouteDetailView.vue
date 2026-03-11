<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import StatusBadge from '@/components/common/StatusBadge.vue';
import LiveMap from '@/components/map/LiveMap.vue';
import { useRouteStore } from '@/stores/route.store';

const route = useRoute();
const store = useRouteStore();
const id = route.params.id as string;

onMounted(() => { store.fetchOne(id); });

const mapRoute = computed(() => {
  if (!store.currentRoute?.stops) return [];
  return store.currentRoute.stops
    .sort((a, b) => a.sequence - b.sequence)
    .map(s => ({ latitude: s.latitude, longitude: s.longitude }));
});

async function onCompleteStop(stopId: string) {
  await store.completeStop(id, stopId);
  await store.fetchOne(id);
}
</script>

<template>
  <div v-if="store.currentRoute">
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-slate-900">{{ store.currentRoute.name }}</h1>
      <StatusBadge :status="store.currentRoute.status" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">Route Info</h3>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between"><dt class="text-slate-500">Driver</dt>
            <dd class="text-slate-900">{{ store.currentRoute.driver ? `${store.currentRoute.driver.first_name} ${store.currentRoute.driver.last_name}` : '-' }}</dd>
          </div>
          <div class="flex justify-between"><dt class="text-slate-500">Vehicle</dt>
            <dd class="text-slate-900">{{ store.currentRoute.vehicle?.registration ?? '-' }}</dd>
          </div>
          <div class="flex justify-between"><dt class="text-slate-500">Distance</dt>
            <dd class="text-slate-900">{{ store.currentRoute.estimated_distance_km?.toFixed(1) ?? '-' }} km</dd>
          </div>
        </dl>
      </div>
      <LiveMap :route="mapRoute" height="300px" :show-vehicles="false" />
    </div>

    <!-- Stops -->
    <div class="bg-white rounded-lg border border-slate-200 p-4">
      <h3 class="text-sm font-medium text-slate-500 mb-3">Stops</h3>
      <div class="space-y-2">
        <div v-for="stop in (store.currentRoute.stops ?? []).sort((a, b) => a.sequence - b.sequence)" :key="stop.id"
          class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <span class="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">{{ stop.sequence }}</span>
          <div class="flex-1">
            <p class="text-sm text-slate-900">{{ stop.address }}</p>
            <p v-if="stop.arrival_time" class="text-xs text-slate-500">ETA: {{ new Date(stop.arrival_time).toLocaleString() }}</p>
          </div>
          <StatusBadge :status="stop.status" />
          <button v-if="stop.status === 'pending'"
            class="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
            @click="onCompleteStop(stop.id)">
            Complete
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="store.loading" class="animate-pulse space-y-4">
    <div class="h-8 bg-slate-200 rounded w-1/3"></div>
    <div class="h-64 bg-slate-200 rounded"></div>
  </div>
</template>
