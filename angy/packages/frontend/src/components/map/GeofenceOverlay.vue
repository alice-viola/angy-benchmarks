<script setup lang="ts">
import { LCircle } from '@vue-leaflet/vue-leaflet';
import type { Geofence } from '@/stores/geofence.store';

defineProps<{
  geofences: Geofence[];
}>();

function getColor(gf: Geofence): string {
  return gf.color || '#3b82f6';
}
</script>

<template>
  <LCircle
    v-for="gf in geofences"
    :key="gf.id"
    :lat-lng="[gf.center_latitude ?? 0, gf.center_longitude ?? 0]"
    :radius="gf.radius_meters ?? 0"
    :color="getColor(gf)"
    :fill-color="getColor(gf)"
    :fill-opacity="0.15"
  />
</template>
