<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { MapPin, Maximize2 } from 'lucide-vue-next';
import type { GeofenceResponse } from '@nexusfleet/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapVehicle {
  id: string;
  lat: number;
  lng: number;
  heading?: number | null;
  status?: string;
  registration?: string;
  speed_kmh?: number | null;
  make?: string;
  model?: string;
}

const props = withDefaults(
  defineProps<{
    vehicles?: MapVehicle[];
    geofences?: GeofenceResponse[];
    routeCoordinates?: Array<[number, number]>;
    routeDashed?: boolean;
    height?: string;
    trackVehicleId?: string | null;
  }>(),
  {
    vehicles: () => [],
    geofences: () => [],
    routeCoordinates: () => [],
    routeDashed: false,
    height: '400px',
    trackVehicleId: null,
  }
);

const emit = defineEmits<{
  'vehicle-click': [vehicle: MapVehicle];
}>();

const mapContainer = ref<HTMLElement | null>(null);
const loading = ref(true);

let map: L.Map | null = null;
const vehicleMarkers = new Map<string, L.Marker>();
const geofenceCircles = new Map<string, L.Circle>();
let routePolyline: L.Polyline | null = null;

const statusColors: Record<string, string> = {
  in_transit: '#3B5FEE',
  available: '#10B981',
  maintenance: '#F59E0B',
  idle: '#94A3B8',
  driving: '#3B5FEE',
};

function createVehicleSvgIcon(heading: number, status: string): L.DivIcon {
  const color = statusColors[status] || '#94A3B8';
  const svg = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading}deg)">
    <circle cx="14" cy="14" r="12" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>
    <path d="M14 6 L20 18 L14 15 L8 18 Z" fill="${color}"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    className: 'vehicle-div-icon',
  });
}

function initMap() {
  if (!mapContainer.value) return;

  map = L.map(mapContainer.value, {
    center: [40.7128, -74.006], // NYC default
    zoom: 11,
    zoomControl: false,
  });

  // CartoDB Positron tiles for cleaner look
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Zoom control top-right
  L.control.zoom({ position: 'topright' }).addTo(map);

  loading.value = false;

  // Initial render
  nextTick(() => {
    updateVehicleMarkers();
    updateGeofences();
    updateRoute();
    fitBounds();
  });
}

function updateVehicleMarkers() {
  if (!map) return;

  const currentIds = new Set(props.vehicles.map((v) => v.id));

  // Remove markers for vehicles no longer in the list
  for (const [id, marker] of vehicleMarkers) {
    if (!currentIds.has(id)) {
      map.removeLayer(marker);
      vehicleMarkers.delete(id);
    }
  }

  // Add/update markers
  for (const vehicle of props.vehicles) {
    const heading = vehicle.heading ?? 0;
    const status = vehicle.status || 'idle';
    const existingMarker = vehicleMarkers.get(vehicle.id);

    if (existingMarker) {
      // Smooth position update
      existingMarker.setLatLng([vehicle.lat, vehicle.lng]);
      existingMarker.setIcon(createVehicleSvgIcon(heading, status));
    } else {
      const marker = L.marker([vehicle.lat, vehicle.lng], {
        icon: createVehicleSvgIcon(heading, status),
      });

      marker.bindPopup(() => {
        const div = document.createElement('div');
        div.className = 'vehicle-popup';
        div.innerHTML = `
          <div style="min-width: 180px; font-family: Inter, system-ui, sans-serif;">
            <p style="font-weight: 500; font-size: 14px; margin: 0 0 4px 0; color: #1E293B;">
              ${vehicle.registration || vehicle.id}
            </p>
            ${vehicle.make ? `<p style="font-size: 12px; color: #64748B; margin: 0 0 4px 0;">${vehicle.make} ${vehicle.model || ''}</p>` : ''}
            <p style="font-size: 12px; color: #64748B; margin: 0 0 8px 0;">
              ${vehicle.speed_kmh != null ? `${vehicle.speed_kmh} km/h` : 'Speed N/A'} · ${status.replace(/_/g, ' ')}
            </p>
          </div>
        `;
        return div;
      });

      marker.on('click', () => {
        emit('vehicle-click', vehicle);
      });

      marker.addTo(map!);
      vehicleMarkers.set(vehicle.id, marker);
    }
  }

  // Track mode
  if (props.trackVehicleId) {
    const tracked = props.vehicles.find((v) => v.id === props.trackVehicleId);
    if (tracked && map) {
      map.setView([tracked.lat, tracked.lng], map.getZoom());
    }
  }
}

function updateGeofences() {
  if (!map) return;

  const currentIds = new Set(props.geofences.map((g) => g.id));

  for (const [id, circle] of geofenceCircles) {
    if (!currentIds.has(id)) {
      map.removeLayer(circle);
      geofenceCircles.delete(id);
    }
  }

  for (const geofence of props.geofences) {
    const color = geofence.color || '#3B82F6';
    const existing = geofenceCircles.get(geofence.id);

    if (existing) {
      existing.setLatLng([geofence.center.lat, geofence.center.lng]);
      existing.setRadius(geofence.radius_m);
      existing.setStyle({
        fillColor: color,
        color: color,
      });
    } else {
      const circle = L.circle([geofence.center.lat, geofence.center.lng], {
        radius: geofence.radius_m,
        fillColor: color,
        fillOpacity: 0.08,
        color: color,
        weight: 2,
        opacity: 0.5,
      });

      circle.bindTooltip(geofence.name, {
        permanent: false,
        direction: 'top',
      });

      circle.addTo(map!);
      geofenceCircles.set(geofence.id, circle);
    }
  }
}

function updateRoute() {
  if (!map) return;

  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }

  if (props.routeCoordinates.length > 1) {
    routePolyline = L.polyline(props.routeCoordinates, {
      color: '#3B5FEE',
      weight: 3,
      opacity: 0.7,
      dashArray: props.routeDashed ? '8, 8' : undefined,
    }).addTo(map);
  }
}

function fitBounds() {
  if (!map) return;

  const bounds = L.latLngBounds([]);

  for (const v of props.vehicles) {
    bounds.extend([v.lat, v.lng]);
  }
  for (const g of props.geofences) {
    bounds.extend([g.center.lat, g.center.lng]);
  }
  for (const coord of props.routeCoordinates) {
    bounds.extend(coord);
  }

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

watch(() => props.vehicles, updateVehicleMarkers, { deep: true });
watch(() => props.geofences, updateGeofences, { deep: true });
watch(
  () => props.routeCoordinates,
  () => {
    updateRoute();
  },
  { deep: true }
);

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
  vehicleMarkers.clear();
  geofenceCircles.clear();
});
</script>

<template>
  <div class="relative rounded-xl overflow-hidden border border-neutral-200 shadow-sm bg-white">
    <!-- Loading skeleton -->
    <div
      v-if="loading"
      :style="{ height }"
      class="bg-neutral-100 flex items-center justify-center"
    >
      <div class="text-center">
        <MapPin class="w-12 h-12 text-neutral-300 mx-auto mb-2 animate-pulse" />
        <p class="text-sm text-neutral-400">Loading map...</p>
      </div>
    </div>

    <!-- Map container -->
    <div
      ref="mapContainer"
      :style="{ height }"
      class="w-full"
    />

    <!-- Empty state overlay -->
    <div
      v-if="!loading && vehicles.length === 0 && geofences.length === 0 && routeCoordinates.length === 0"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div class="text-center bg-white/80 backdrop-blur-sm rounded-xl p-6">
        <div class="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
          <MapPin class="w-6 h-6 text-neutral-300" />
        </div>
        <p class="text-sm font-medium text-neutral-600">No data to display</p>
        <p class="text-xs text-neutral-400 mt-1">Vehicle positions will appear here</p>
      </div>
    </div>

    <!-- Fit bounds button -->
    <button
      v-if="!loading && (vehicles.length > 0 || geofences.length > 0)"
      class="absolute bottom-3 right-3 z-[1000] bg-white rounded-lg shadow-md border border-neutral-200 p-2 hover:bg-neutral-50 transition-colors"
      title="Fit all markers"
      @click="fitBounds"
    >
      <Maximize2 class="w-4 h-4 text-neutral-600" />
    </button>
  </div>
</template>

<style>
.vehicle-div-icon {
  background: transparent !important;
  border: none !important;
}

.leaflet-popup-content-wrapper {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid #E2E8F0;
}

.leaflet-popup-tip {
  box-shadow: none;
}
</style>
