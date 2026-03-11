<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import VehicleMarker from './VehicleMarker.vue';
import GeofenceOverlay from './GeofenceOverlay.vue';
import RoutePolyline from './RoutePolyline.vue';
import { useTrackingStore } from '@/stores/tracking.store';
import type { Geofence } from '@/stores/geofence.store';

const props = withDefaults(defineProps<{
  geofences?: Geofence[];
  route?: Array<{ latitude: number; longitude: number }>;
  showVehicles?: boolean;
  center?: [number, number];
  zoom?: number;
  height?: string;
}>(), {
  showVehicles: true,
  zoom: 5,
  height: '100%',
});

const tracking = useTrackingStore();
const mapRef = ref<{ leafletObject: LeafletMap } | null>(null);
const mapReady = ref(false);

const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution = '&copy; OpenStreetMap contributors';

const defaultCenter = computed<[number, number]>(() => props.center ?? [40, -95]);

const vehicleEntries = computed(() => {
  if (!props.showVehicles) return [];
  return Array.from(tracking.positions.entries()).map(([id, pos]) => ({
    id,
    ...pos,
  }));
});

function onMapReady() {
  mapReady.value = true;
  fitBounds();
}

function fitBounds() {
  const map = mapRef.value?.leafletObject;
  if (!map) return;
  const points: [number, number][] = [];
  if (props.showVehicles) {
    vehicleEntries.value.forEach(v => points.push([v.lat, v.lng]));
  }
  if (props.route) {
    props.route.forEach(p => points.push([p.latitude, p.longitude]));
  }
  if (points.length > 1) {
    const L = (window as unknown as { L: typeof import('leaflet') }).L;
    if (L?.latLngBounds) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    }
  }
}

watch(() => vehicleEntries.value.length, (newLen, oldLen) => {
  if (oldLen === 0 && newLen > 0) {
    nextTick(() => fitBounds());
  }
});
</script>

<template>
  <div :style="{ height }" class="w-full rounded-lg overflow-hidden border border-slate-200">
    <LMap
      ref="mapRef"
      :zoom="zoom"
      :center="defaultCenter"
      :use-global-leaflet="false"
      class="w-full h-full"
      @ready="onMapReady"
    >
      <LTileLayer :url="tileUrl" :attribution="attribution" />
      <VehicleMarker
        v-for="v in vehicleEntries"
        :key="v.id"
        :vehicle-id="v.id"
        :lat="v.lat"
        :lng="v.lng"
        :speed="v.speed_kmh"
        :heading="v.heading"
        :timestamp="v.timestamp"
      />
      <GeofenceOverlay
        v-if="geofences"
        :geofences="geofences"
      />
      <RoutePolyline
        v-if="route && route.length >= 2"
        :coordinates="route"
      />
    </LMap>
  </div>
</template>
