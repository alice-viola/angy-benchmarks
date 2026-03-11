<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  centerLat?: number;
  centerLng?: number;
  radiusM?: number;
}>();

const emit = defineEmits<{
  'update:centerLat': [lat: number];
  'update:centerLng': [lng: number];
  'update:radiusM': [radius: number];
}>();

const lat = ref(props.centerLat ?? 0);
const lng = ref(props.centerLng ?? 0);
const radius = ref(props.radiusM ?? 500);

watch(() => props.centerLat, (v) => { if (v !== undefined) lat.value = v; });
watch(() => props.centerLng, (v) => { if (v !== undefined) lng.value = v; });
watch(() => props.radiusM, (v) => { if (v !== undefined) radius.value = v; });

function onMapClick(event: { latlng?: { lat: number; lng: number } }) {
  if (event.latlng) {
    lat.value = event.latlng.lat;
    lng.value = event.latlng.lng;
    emit('update:centerLat', lat.value);
    emit('update:centerLng', lng.value);
  }
}

function onRadiusChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  radius.value = val;
  emit('update:radiusM', val);
}

defineExpose({ onMapClick, lat, lng, radius });
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm text-slate-600">Click on the map to set the geofence center.</p>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">Latitude</label>
        <input :value="lat" type="number" step="any" readonly
          class="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-slate-50" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">Longitude</label>
        <input :value="lng" type="number" step="any" readonly
          class="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-slate-50" />
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-500 mb-1">Radius (meters): {{ radius }}m</label>
      <input type="range" min="50" max="10000" step="50" :value="radius" @input="onRadiusChange"
        class="w-full" />
      <input type="number" :value="radius" min="50" @input="onRadiusChange"
        class="mt-1 w-full px-2 py-1.5 text-sm border border-slate-300 rounded" />
    </div>
  </div>
</template>
