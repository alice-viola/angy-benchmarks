<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRouteStore } from '../../stores/routes';
import { useToast } from '../../composables/useToast';
import StopList from './StopList.vue';
import UnassignedShipmentsList from './UnassignedShipmentsList.vue';
import type { ShipmentResponse } from '@nexusfleet/shared';
import { Save, Sparkles, Loader2, Package, ListOrdered } from 'lucide-vue-next';
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';

const router = useRouter();
const routeStore = useRouteStore();
const { addToast } = useToast();

const name = ref('');
const plannedDate = ref(new Date().toISOString().slice(0, 10));
const saving = ref(false);
const optimizing = ref(false);
const activeTab = ref<'stops' | 'unassigned'>('stops');

const stops = computed(() => routeStore.currentRoute?.stops || []);

const mapCenter = ref<[number, number]>([40.7128, -74.006]);
const mapZoom = ref(12);

onMounted(() => {
  if (routeStore.currentRoute) {
    name.value = routeStore.currentRoute.name;
    plannedDate.value = routeStore.currentRoute.planned_date;
  }
});

watch(stops, (newStops) => {
  if (newStops.length > 0) {
    const lats = newStops.map((s) => s.location.lat);
    const lngs = newStops.map((s) => s.location.lng);
    mapCenter.value = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  }
});

async function handleSave() {
  if (!name.value.trim()) {
    addToast({ type: 'warning', title: 'Please enter a route name' });
    return;
  }
  saving.value = true;
  try {
    const route = await routeStore.create({
      name: name.value,
      planned_date: plannedDate.value,
    });
    addToast({ type: 'success', title: 'Route created' });
    router.push(`/routes/${route.id}`);
  } catch {
    addToast({ type: 'error', title: 'Failed to create route' });
  } finally {
    saving.value = false;
  }
}

async function handleOptimize() {
  if (!routeStore.currentRoute) return;
  optimizing.value = true;
  try {
    const jobId = await routeStore.optimize(routeStore.currentRoute.id);
    await routeStore.pollOptimization(routeStore.currentRoute.id, jobId);
    await routeStore.fetch(routeStore.currentRoute.id);
    addToast({ type: 'success', title: 'Route optimized' });
  } catch {
    addToast({ type: 'error', title: 'Optimization failed' });
  } finally {
    optimizing.value = false;
  }
}

function handleAddShipment(_shipment: ShipmentResponse) {
  addToast({ type: 'info', title: 'Shipment queued for route assignment' });
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
    <!-- Left panel -->
    <div class="space-y-4">
      <!-- Route info -->
      <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
        <h2 class="text-base font-medium text-neutral-800 mb-4">Route Details</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-neutral-500 mb-1">Route Name</label>
            <input
              v-model="name"
              type="text"
              placeholder="e.g. Morning Deliveries"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-neutral-500 mb-1">Planned Date</label>
            <input
              v-model="plannedDate"
              type="date"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>
          <div class="flex gap-2 pt-2">
            <button
              :disabled="saving"
              class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="handleSave"
            >
              <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
              <Save v-else class="w-4 h-4" />
              Save Route
            </button>
            <button
              :disabled="optimizing || !routeStore.currentRoute"
              class="inline-flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="handleOptimize"
            >
              <Loader2 v-if="optimizing" class="w-4 h-4 animate-spin" />
              <Sparkles v-else class="w-4 h-4" />
              Optimize
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs: stops / unassigned -->
      <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div class="flex border-b border-neutral-200">
          <button
            :class="[
              'flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors',
              activeTab === 'stops' ? 'text-primary-600 border-b-2 border-primary-500' : 'text-neutral-400 hover:text-neutral-600',
            ]"
            @click="activeTab = 'stops'"
          >
            <ListOrdered class="w-4 h-4" />
            Stops
          </button>
          <button
            :class="[
              'flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors',
              activeTab === 'unassigned' ? 'text-primary-600 border-b-2 border-primary-500' : 'text-neutral-400 hover:text-neutral-600',
            ]"
            @click="activeTab = 'unassigned'"
          >
            <Package class="w-4 h-4" />
            Unassigned
          </button>
        </div>
        <div class="p-4">
          <StopList
            v-if="activeTab === 'stops'"
            :stops="stops"
          />
          <UnassignedShipmentsList
            v-else
            @add-shipment="handleAddShipment"
          />
        </div>
      </div>
    </div>

    <!-- Map (right side, 2 cols) -->
    <div class="lg:col-span-2 bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
      <h2 class="text-base font-medium text-neutral-800 mb-4">Route Map</h2>
      <div class="h-[calc(100vh-280px)] min-h-[400px] rounded-lg overflow-hidden">
        <l-map
          :zoom="mapZoom"
          :center="mapCenter"
          :use-global-leaflet="false"
          class="h-full w-full"
        >
          <l-tile-layer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            layer-type="base"
          />
          <l-marker
            v-for="stop in stops"
            :key="stop.id"
            :lat-lng="[stop.location.lat, stop.location.lng]"
          >
            <l-popup>
              <div class="text-xs">
                <p class="font-medium capitalize">{{ stop.stop_type }} #{{ stop.sequence_order + 1 }}</p>
                <p class="text-neutral-500">{{ stop.address }}</p>
              </div>
            </l-popup>
          </l-marker>
        </l-map>
      </div>
    </div>
  </div>
</template>
