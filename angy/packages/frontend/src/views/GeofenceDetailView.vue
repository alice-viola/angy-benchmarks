<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { LMap, LTileLayer, LCircle } from '@vue-leaflet/vue-leaflet';
import { useGeofenceStore } from '@/stores/geofence.store';

const route = useRoute();
const store = useGeofenceStore();
const id = route.params.id as string;

onMounted(() => { store.fetchOne(id); });

const center = computed<[number, number]>(() => [
  store.currentGeofence?.center_latitude ?? 40,
  store.currentGeofence?.center_longitude ?? -95,
]);
</script>

<template>
  <div v-if="store.currentGeofence" class="flex flex-col lg:flex-row gap-6" style="min-height: 500px;">
    <div class="lg:flex-1">
      <LMap :zoom="13" :center="center" :use-global-leaflet="false" class="w-full h-full min-h-[400px] rounded-lg border border-slate-200">
        <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <LCircle :lat-lng="center" :radius="store.currentGeofence.radius_meters ?? 500" color="#3b82f6" :fill-opacity="0.15" />
      </LMap>
    </div>
    <div class="lg:w-80">
      <h2 class="text-lg font-semibold text-slate-900 mb-4">{{ store.currentGeofence.name }}</h2>
      <dl class="space-y-3 text-sm">
        <div class="flex justify-between"><dt class="text-slate-500">Type</dt><dd class="text-slate-900 capitalize">{{ store.currentGeofence.type }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Radius</dt><dd class="text-slate-900">{{ store.currentGeofence.radius_meters }} m</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Enter Trigger</dt><dd class="text-slate-900">{{ store.currentGeofence.trigger_on_enter ? 'Yes' : 'No' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Exit Trigger</dt><dd class="text-slate-900">{{ store.currentGeofence.trigger_on_exit ? 'Yes' : 'No' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Active</dt><dd class="text-slate-900">{{ store.currentGeofence.is_active ? 'Yes' : 'No' }}</dd></div>
      </dl>
      <p v-if="store.currentGeofence.description" class="mt-4 text-sm text-slate-600">{{ store.currentGeofence.description }}</p>
    </div>
  </div>
  <div v-else-if="store.loading" class="animate-pulse space-y-4">
    <div class="h-8 bg-slate-200 rounded w-1/3"></div>
    <div class="h-96 bg-slate-200 rounded"></div>
  </div>
</template>
