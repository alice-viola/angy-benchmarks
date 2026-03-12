<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { useTrackingStore } from '@/stores/tracking';
import { useGeofencesStore } from '@/stores/geofences';
import type { VehicleLocation } from '@nexus-fleet/shared';
import type { Geofence, Route } from '@/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const props = withDefaults(
  defineProps<{
    height?: string;
    showGeofences?: boolean;
    routes?: Route[];
    trackVehicleId?: string | null;
    center?: [number, number];
    zoom?: number;
  }>(),
  {
    height: '500px',
    showGeofences: true,
    trackVehicleId: null,
    zoom: 10,
  },
);

const emit = defineEmits<{
  'vehicle-click': [vehicleId: string];
  'track-vehicle': [vehicleId: string];
}>();

const trackingStore = useTrackingStore();
const geofencesStore = useGeofencesStore();

const mapContainer = ref<HTMLDivElement>();
let map: L.Map | null = null;
let markerClusterGroup: L.MarkerClusterGroup | null = null;
const vehicleMarkers = new Map<string, L.Marker>();
const geofenceCircles = new Map<string, L.Circle>();
const routePolylines: L.Polyline[] = [];

function createVehicleSvgIcon(heading: number, color = '#3B82F6'): L.DivIcon {
  return L.divIcon({
    className: 'vehicle-marker',
    html: `<div style="transform: rotate(${heading}deg); width: 32px; height: 32px;">
      <svg viewBox="0 0 32 32" width="32" height="32">
        <path d="M16 2 L26 28 L16 22 L6 28 Z" fill="${color}" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function updateVehicleMarker(location: VehicleLocation) {
  const latLng = L.latLng(location.lat, location.lng);
  const existing = vehicleMarkers.get(location.vehicle_id);

  if (existing) {
    // Smooth transition via CSS
    existing.setLatLng(latLng);
    existing.setIcon(createVehicleSvgIcon(location.heading));
  } else {
    const marker = L.marker(latLng, {
      icon: createVehicleSvgIcon(location.heading),
    });

    marker.bindPopup(`
      <div class="text-sm">
        <p class="font-semibold">Vehicle ${location.vehicle_id.slice(0, 8)}</p>
        <p>Speed: ${location.speed_kmh.toFixed(1)} km/h</p>
        <p>Heading: ${location.heading.toFixed(0)}&deg;</p>
        <p class="text-xs text-gray-500">${new Date(location.timestamp).toLocaleTimeString()}</p>
        <button class="mt-2 text-xs text-blue-600 hover:underline track-btn" data-vehicle-id="${location.vehicle_id}">
          Track Vehicle
        </button>
      </div>
    `);

    marker.on('click', () => {
      emit('vehicle-click', location.vehicle_id);
    });

    marker.on('popupopen', () => {
      const btn = document.querySelector(`.track-btn[data-vehicle-id="${location.vehicle_id}"]`);
      btn?.addEventListener('click', () => {
        emit('track-vehicle', location.vehicle_id);
      });
    });

    if (markerClusterGroup) {
      markerClusterGroup.addLayer(marker);
    }
    vehicleMarkers.set(location.vehicle_id, marker);
  }

  // Follow tracked vehicle
  if (props.trackVehicleId === location.vehicle_id && map) {
    map.panTo(latLng, { animate: true });
  }
}

function updateGeofences(geofences: Geofence[]) {
  if (!map || !props.showGeofences) return;

  // Remove old circles
  geofenceCircles.forEach((circle) => circle.remove());
  geofenceCircles.clear();

  geofences.forEach((geofence) => {
    if (!geofence.is_active) return;

    const circle = L.circle([geofence.center_lat, geofence.center_lng], {
      radius: geofence.radius_m,
      color: geofence.color,
      fillColor: geofence.color,
      fillOpacity: 0.15,
      weight: 2,
    });

    circle.bindTooltip(geofence.name);
    circle.addTo(map!);
    geofenceCircles.set(geofence.id, circle);
  });
}

function updateRoutes(routes: Route[]) {
  if (!map) return;

  // Remove old polylines
  routePolylines.forEach((p) => p.remove());
  routePolylines.length = 0;

  routes.forEach((route) => {
    if (!route.stops || route.stops.length < 2) return;

    const sortedStops = [...route.stops].sort((a, b) => a.sequence_order - b.sequence_order);
    const latlngs = sortedStops.map((stop) => L.latLng(stop.location_lat, stop.location_lng));

    const polyline = L.polyline(latlngs, {
      color: '#3B82F6',
      weight: 3,
      opacity: 0.8,
      dashArray: '10, 5',
    });

    polyline.addTo(map!);
    routePolylines.push(polyline);

    // Add numbered stop markers
    sortedStops.forEach((stop, index) => {
      const marker = L.marker([stop.location_lat, stop.location_lng], {
        icon: L.divIcon({
          className: 'stop-marker',
          html: `<div class="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold border-2 border-white shadow">${index + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      });

      marker.bindTooltip(stop.address);
      marker.addTo(map!);
    });
  });
}

function fitBoundsToVehicles() {
  if (!map || vehicleMarkers.size === 0) return;

  const bounds = L.latLngBounds([]);
  vehicleMarkers.forEach((marker) => {
    bounds.extend(marker.getLatLng());
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

onMounted(() => {
  if (!mapContainer.value) return;

  const defaultCenter = props.center || [51.505, -0.09];
  map = L.map(mapContainer.value).setView(defaultCenter, props.zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // Use marker clustering when > 50 vehicles
  markerClusterGroup = L.markerClusterGroup({
    disableClusteringAtZoom: 15,
    maxClusterRadius: 50,
  });
  map.addLayer(markerClusterGroup);

  // Initial vehicle positions
  trackingStore.vehicleList.forEach(updateVehicleMarker);

  if (trackingStore.vehicleList.length > 0) {
    fitBoundsToVehicles();
  }

  // Geofences
  if (props.showGeofences) {
    updateGeofences(geofencesStore.geofences);
  }

  // Routes
  if (props.routes) {
    updateRoutes(props.routes);
  }
});

// Watch for vehicle position updates
watch(
  () => trackingStore.vehicleList,
  (vehicles) => {
    vehicles.forEach(updateVehicleMarker);
  },
  { deep: true },
);

watch(
  () => geofencesStore.geofences,
  (geofences) => {
    updateGeofences(geofences);
  },
  { deep: true },
);

watch(
  () => props.routes,
  (routes) => {
    if (routes) updateRoutes(routes);
  },
  { deep: true },
);

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<template>
  <div class="relative rounded-xl overflow-hidden border border-gray-200">
    <div ref="mapContainer" :style="{ height }" class="w-full" />

    <!-- Connection status indicator -->
    <div class="absolute top-3 right-3 z-[1000]">
      <div
        :class="[
          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-sm',
          trackingStore.connectionStatus === 'connected'
            ? 'bg-success-100 text-success-700'
            : trackingStore.connectionStatus === 'reconnecting'
              ? 'bg-warning-100 text-warning-700'
              : 'bg-danger-100 text-danger-700',
        ]"
      >
        <div
          :class="[
            'h-2 w-2 rounded-full',
            trackingStore.connectionStatus === 'connected'
              ? 'bg-success-500'
              : trackingStore.connectionStatus === 'reconnecting'
                ? 'bg-warning-500 animate-pulse'
                : 'bg-danger-500',
          ]"
        />
        {{ trackingStore.connectionStatus }}
      </div>
    </div>

    <!-- Vehicle count -->
    <div class="absolute bottom-3 left-3 z-[1000]">
      <div class="rounded-lg bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
        {{ trackingStore.vehicleCount }} vehicles
      </div>
    </div>
  </div>
</template>

<style>
.vehicle-marker {
  background: transparent;
  border: none;
  transition: transform 0.5s ease;
}

.stop-marker {
  background: transparent;
  border: none;
}
</style>
