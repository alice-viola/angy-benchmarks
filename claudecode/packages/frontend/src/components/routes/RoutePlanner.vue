<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useShipmentsStore } from '@/stores/shipments';
import { useRoutesStore } from '@/stores/routes';
import type { Shipment, RouteStop } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const props = defineProps<{
  routeId?: string;
}>();

const emit = defineEmits<{
  saved: [routeId: string];
}>();

const shipmentsStore = useShipmentsStore();
const routesStore = useRoutesStore();

const routeName = ref('');
const plannedDate = ref('');
const stops = ref<Array<{
  id: string;
  shipment_id?: string;
  shipment?: Shipment;
  stop_type: string;
  location_lat: number;
  location_lng: number;
  address: string;
  sequence_order: number;
}>>([]);
const searchQuery = ref('');
const saving = ref(false);
const mapContainer = ref<HTMLDivElement>();
let map: L.Map | null = null;
let markers: L.Marker[] = [];
let polyline: L.Polyline | null = null;

const unassignedShipments = computed(() => {
  const assignedIds = new Set(stops.value.map((s) => s.shipment_id).filter(Boolean));
  return shipmentsStore.shipments.filter(
    (s) =>
      !assignedIds.has(s.id) &&
      ['confirmed', 'assigned'].includes(s.status) &&
      (searchQuery.value === '' ||
        s.customer_name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        s.reference_code.toLowerCase().includes(searchQuery.value.toLowerCase())),
  );
});

const totalWeight = computed(() =>
  stops.value.reduce((sum, s) => sum + (s.shipment?.cargo_weight_kg || 0), 0),
);

const maxWeight = 10000; // Default max capacity

const weightPercentage = computed(() =>
  Math.min((totalWeight.value / maxWeight) * 100, 100),
);

const estimatedDistance = computed(() => {
  if (stops.value.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < stops.value.length; i++) {
    const prev = stops.value[i - 1];
    const curr = stops.value[i];
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(curr.location_lat - prev.location_lat);
    const dLng = toRad(curr.location_lng - prev.location_lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(prev.location_lat)) *
        Math.cos(toRad(curr.location_lat)) *
        Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
});

function addShipmentToRoute(shipment: Shipment) {
  // Add pickup stop
  stops.value.push({
    id: `pickup-${shipment.id}`,
    shipment_id: shipment.id,
    shipment,
    stop_type: 'pickup',
    location_lat: shipment.origin_lat,
    location_lng: shipment.origin_lng,
    address: shipment.origin_address,
    sequence_order: stops.value.length,
  });

  // Add delivery stop
  stops.value.push({
    id: `delivery-${shipment.id}`,
    shipment_id: shipment.id,
    shipment,
    stop_type: 'delivery',
    location_lat: shipment.dest_lat,
    location_lng: shipment.dest_lng,
    address: shipment.dest_address,
    sequence_order: stops.value.length,
  });

  updateSequenceOrders();
  updateMap();
}

function removeStop(index: number) {
  stops.value.splice(index, 1);
  updateSequenceOrders();
  updateMap();
}

function moveStop(fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= stops.value.length) return;
  const item = stops.value.splice(fromIndex, 1)[0];
  stops.value.splice(toIndex, 0, item);
  updateSequenceOrders();
  updateMap();
}

function updateSequenceOrders() {
  stops.value.forEach((stop, i) => {
    stop.sequence_order = i;
  });
}

function updateMap() {
  if (!map) return;

  // Clear old markers and polyline
  markers.forEach((m) => m.remove());
  markers = [];
  polyline?.remove();
  polyline = null;

  if (stops.value.length === 0) return;

  const latlngs: L.LatLng[] = [];

  stops.value.forEach((stop, index) => {
    const ll = L.latLng(stop.location_lat, stop.location_lng);
    latlngs.push(ll);

    const color = stop.stop_type === 'pickup' ? '#3B82F6' : '#10B981';
    const marker = L.marker(ll, {
      icon: L.divIcon({
        className: 'stop-marker',
        html: `<div style="background:${color}" class="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold border-2 border-white shadow-md">${index + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    });

    marker.bindTooltip(`${stop.stop_type === 'pickup' ? 'Pickup' : 'Delivery'}: ${stop.address}`);
    marker.addTo(map!);
    markers.push(marker);
  });

  polyline = L.polyline(latlngs, {
    color: '#6366F1',
    weight: 3,
    opacity: 0.7,
    dashArray: '8, 6',
  }).addTo(map);

  if (latlngs.length > 0) {
    map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
  }
}

async function handleOptimize() {
  if (!props.routeId) return;
  await routesStore.optimizeRoute(props.routeId);
}

async function handleSave() {
  saving.value = true;
  try {
    const routeData = {
      name: routeName.value,
      planned_date: plannedDate.value,
      stops: stops.value.map((s) => ({
        shipment_id: s.shipment_id,
        stop_type: s.stop_type as 'pickup' | 'delivery' | 'depot',
        location_lat: s.location_lat,
        location_lng: s.location_lng,
        address: s.address,
        sequence_order: s.sequence_order,
      })),
    };

    if (props.routeId) {
      await routesStore.updateRoute(props.routeId, routeData);
      emit('saved', props.routeId);
    } else {
      const response = await routesStore.createRoute(routeData);
      if (response?.success) {
        emit('saved', (response.data as any).id);
      }
    }
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await shipmentsStore.fetchShipments({ pageSize: 100 });

  if (mapContainer.value) {
    map = L.map(mapContainer.value).setView([51.505, -0.09], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
  }

  if (props.routeId) {
    await routesStore.fetchRoute(props.routeId);
    if (routesStore.currentRoute) {
      routeName.value = routesStore.currentRoute.name;
      plannedDate.value = routesStore.currentRoute.planned_date;
      stops.value = routesStore.currentRoute.stops.map((s) => ({
        ...s,
        shipment: shipmentsStore.shipments.find((sh) => sh.id === s.shipment_id),
      }));
      updateMap();
    }
  }
});

onUnmounted(() => {
  map?.remove();
  map = null;
});

watch(stops, () => updateMap(), { deep: true });
</script>

<template>
  <div class="space-y-4">
    <!-- Route info bar -->
    <div class="card">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="label">Route Name</label>
          <input v-model="routeName" type="text" class="input" placeholder="Route name" />
        </div>
        <div>
          <label class="label">Planned Date</label>
          <input v-model="plannedDate" type="date" class="input" />
        </div>
        <div class="flex items-end gap-2">
          <button class="btn-primary flex-1" :disabled="saving || stops.length === 0" @click="handleSave">
            {{ saving ? 'Saving...' : 'Save Route' }}
          </button>
          <button
            v-if="routeId"
            class="btn-secondary"
            :disabled="routesStore.optimizing"
            @click="handleOptimize"
          >
            {{ routesStore.optimizing ? 'Optimizing...' : 'Optimize Route' }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left: Shipments + stops -->
      <div class="space-y-4">
        <!-- Unassigned shipments -->
        <div class="card">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">Unassigned Shipments</h3>
          <input
            v-model="searchQuery"
            type="text"
            class="input mb-3"
            placeholder="Search shipments..."
          />
          <div class="max-h-48 overflow-y-auto space-y-2">
            <div
              v-for="shipment in unassignedShipments"
              :key="shipment.id"
              class="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{{ shipment.reference_code }}</p>
                <p class="text-xs text-gray-500 truncate">{{ shipment.customer_name }}</p>
                <p class="text-xs text-gray-400">{{ shipment.cargo_weight_kg }} kg</p>
              </div>
              <button class="btn-secondary btn-sm flex-shrink-0" @click="addShipmentToRoute(shipment)">
                Add
              </button>
            </div>
            <p v-if="unassignedShipments.length === 0" class="text-sm text-gray-500 text-center py-4">
              No unassigned shipments found.
            </p>
          </div>
        </div>

        <!-- Route stops -->
        <div class="card">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">
            Route Stops ({{ stops.length }})
          </h3>

          <!-- Weight bar -->
          <div class="mb-4">
            <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Cargo Weight</span>
              <span>{{ totalWeight.toFixed(1) }} / {{ maxWeight }} kg</span>
            </div>
            <div class="h-2 w-full rounded-full bg-gray-200">
              <div
                :class="[
                  'h-2 rounded-full transition-all duration-300',
                  weightPercentage > 90 ? 'bg-danger-500' : weightPercentage > 70 ? 'bg-warning-500' : 'bg-success-500',
                ]"
                :style="{ width: `${weightPercentage}%` }"
              />
            </div>
          </div>

          <div class="space-y-2">
            <div
              v-for="(stop, index) in stops"
              :key="stop.id"
              class="flex items-center gap-2 rounded-lg border border-gray-200 p-2"
            >
              <div class="flex flex-col gap-0.5">
                <button
                  class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  :disabled="index === 0"
                  @click="moveStop(index, index - 1)"
                >
                  <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  :disabled="index === stops.length - 1"
                  @click="moveStop(index, index + 1)"
                >
                  <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <div
                :class="[
                  'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                  stop.stop_type === 'pickup' ? 'bg-primary-500' : 'bg-success-500',
                ]"
              >
                {{ index + 1 }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <StatusBadge :status="stop.stop_type" />
                  <span class="text-xs text-gray-500 truncate">{{ stop.address }}</span>
                </div>
                <p v-if="stop.shipment" class="text-xs text-gray-400">
                  {{ stop.shipment.reference_code }} - {{ stop.shipment.cargo_weight_kg }} kg
                </p>
              </div>

              <button
                class="p-1 text-gray-400 hover:text-danger-500"
                @click="removeStop(index)"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p v-if="stops.length === 0" class="text-sm text-gray-500 text-center py-4">
              Add shipments to build your route.
            </p>
          </div>

          <!-- Estimated distance -->
          <div v-if="stops.length >= 2" class="mt-4 pt-4 border-t border-gray-200">
            <p class="text-sm text-gray-600">
              Estimated distance: <span class="font-semibold">{{ estimatedDistance.toFixed(1) }} km</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Right: Map -->
      <div>
        <div ref="mapContainer" class="h-[600px] w-full rounded-xl border border-gray-200 sticky top-4" />
      </div>
    </div>
  </div>
</template>

<style>
.stop-marker {
  background: transparent;
  border: none;
}
</style>
