<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRoutesStore } from '@/stores/routes';
import AppLayout from '@/layouts/AppLayout.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const route = useRoute();
const router = useRouter();
const routesStore = useRoutesStore();

const routeId = route.params.id as string;
const currentRoute = computed(() => routesStore.currentRoute);
const mapContainer = ref<HTMLDivElement>();
let map: L.Map | null = null;

function renderMap() {
  if (!mapContainer.value || !currentRoute.value?.stops?.length) return;

  if (map) map.remove();

  map = L.map(mapContainer.value).setView([51.505, -0.09], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);

  const sorted = [...currentRoute.value.stops].sort((a, b) => a.sequence_order - b.sequence_order);
  const latlngs: L.LatLng[] = [];

  sorted.forEach((stop, index) => {
    const ll = L.latLng(stop.location_lat, stop.location_lng);
    latlngs.push(ll);

    const color = stop.stop_type === 'pickup' ? '#3B82F6' : stop.stop_type === 'depot' ? '#6366F1' : '#10B981';
    L.marker(ll, {
      icon: L.divIcon({
        className: '',
        html: `<div style="background:${color}" class="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold border-2 border-white shadow-md">${index + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    })
      .bindTooltip(`${stop.stop_type}: ${stop.address}`)
      .addTo(map!);
  });

  if (latlngs.length > 1) {
    L.polyline(latlngs, { color: '#6366F1', weight: 3, dashArray: '8, 6' }).addTo(map);
  }

  if (latlngs.length > 0) {
    map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
  }
}

onMounted(async () => {
  await routesStore.fetchRoute(routeId);
  setTimeout(renderMap, 100);
});

onUnmounted(() => {
  map?.remove();
});
</script>

<template>
  <AppLayout>
    <div v-if="routesStore.loading && !currentRoute" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="currentRoute" class="space-y-6">
      <div class="page-header">
        <div class="flex items-center gap-3">
          <button class="p-1 text-gray-400 hover:text-gray-600" @click="router.back()">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 class="page-title">{{ currentRoute.name }}</h1>
            <div class="flex items-center gap-2 mt-1">
              <StatusBadge :status="currentRoute.status" type="route" />
              <span class="text-sm text-gray-500">{{ new Date(currentRoute.planned_date).toLocaleDateString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Stop list -->
        <div class="card">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">
            Stops ({{ currentRoute.stops?.length || 0 }})
          </h3>
          <div v-if="currentRoute.estimated_distance_km" class="mb-4 text-sm text-gray-600">
            Distance: {{ currentRoute.estimated_distance_km.toFixed(1) }} km
            <span v-if="currentRoute.estimated_duration_min">
              | Duration: {{ Math.round(currentRoute.estimated_duration_min) }} min
            </span>
          </div>
          <div class="space-y-2">
            <div
              v-for="(stop, index) in [...(currentRoute.stops || [])].sort((a, b) => a.sequence_order - b.sequence_order)"
              :key="stop.id"
              class="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
            >
              <div
                :class="[
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                  stop.stop_type === 'pickup' ? 'bg-primary-500' : stop.stop_type === 'depot' ? 'bg-indigo-500' : 'bg-success-500',
                ]"
              >
                {{ index + 1 }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <StatusBadge :status="stop.stop_type" />
                  <StatusBadge :status="stop.status" />
                </div>
                <p class="text-xs text-gray-500 truncate mt-0.5">{{ stop.address }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Map -->
        <div class="lg:col-span-2">
          <div ref="mapContainer" class="h-[500px] w-full rounded-xl border border-gray-200" />
        </div>
      </div>
    </div>
  </AppLayout>
</template>
