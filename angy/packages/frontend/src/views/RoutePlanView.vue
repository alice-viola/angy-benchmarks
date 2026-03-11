<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import RoutePlanner from '@/components/routes/RoutePlanner.vue';
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
</script>

<template>
  <div v-if="store.currentRoute" class="flex flex-col lg:flex-row gap-6" style="min-height: 600px;">
    <div class="lg:w-1/2">
      <RoutePlanner :route="store.currentRoute" />
    </div>
    <div class="lg:w-1/2">
      <LiveMap :route="mapRoute" height="100%" :show-vehicles="false" />
    </div>
  </div>
  <div v-else-if="store.loading" class="animate-pulse">
    <div class="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
    <div class="h-96 bg-slate-200 rounded"></div>
  </div>
</template>
