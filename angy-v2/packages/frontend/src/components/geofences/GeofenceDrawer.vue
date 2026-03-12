<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { GeofenceResponse } from '@nexusfleet/shared';
import { LMap, LTileLayer, LCircle, LMarker, LPopup } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';

const props = defineProps<{
  geofence: GeofenceResponse | null;
}>();

const emit = defineEmits<{
  'update:center': [coords: { lat: number; lng: number }];
  'update:radius': [radius: number];
  'update:color': [color: string];
}>();

const mapCenter = computed<[number, number]>(() =>
  props.geofence
    ? [props.geofence.center.lat, props.geofence.center.lng]
    : [40.7128, -74.006]
);

const mapZoom = ref(14);

const circleCenter = computed<[number, number]>(() =>
  props.geofence
    ? [props.geofence.center.lat, props.geofence.center.lng]
    : [40.7128, -74.006]
);

const circleRadius = computed(() => props.geofence?.radius_m || 500);
const circleColor = computed(() => props.geofence?.color || '#3B82F6');

function handleMapClick(e: { latlng: { lat: number; lng: number } }) {
  emit('update:center', { lat: e.latlng.lat, lng: e.latlng.lng });
}

watch(() => props.geofence?.center, (newCenter) => {
  if (newCenter) {
    mapZoom.value = 14;
  }
});
</script>

<template>
  <div class="h-full rounded-lg overflow-hidden">
    <l-map
      :zoom="mapZoom"
      :center="mapCenter"
      :use-global-leaflet="false"
      class="h-full w-full"
      @click="handleMapClick"
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
        layer-type="base"
      />
      <l-circle
        v-if="geofence"
        :lat-lng="circleCenter"
        :radius="circleRadius"
        :color="circleColor"
        :fill-color="circleColor"
        :fill-opacity="0.15"
        :weight="2"
      />
      <l-marker
        v-if="geofence"
        :lat-lng="circleCenter"
      >
        <l-popup>
          <div class="text-xs">
            <p class="font-medium">{{ geofence.name }}</p>
            <p class="text-neutral-500">Radius: {{ geofence.radius_m }}m</p>
          </div>
        </l-popup>
      </l-marker>
    </l-map>
  </div>
</template>
