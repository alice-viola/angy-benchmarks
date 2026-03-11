<script setup lang="ts">
import { computed } from 'vue';
import { LPolyline } from '@vue-leaflet/vue-leaflet';

const props = defineProps<{
  coordinates: Array<{ latitude: number; longitude: number }>;
  color?: string;
}>();

const latLngs = computed(() =>
  props.coordinates.map(c => [c.latitude, c.longitude] as [number, number])
);
</script>

<template>
  <LPolyline
    :lat-lngs="latLngs"
    :color="color || '#3b82f6'"
    :weight="4"
    :opacity="0.8"
  />
</template>
