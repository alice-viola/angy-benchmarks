<script setup lang="ts">
import { computed } from 'vue';
import type { GeofenceResponse } from '@nexusfleet/shared';

const props = defineProps<{
  geofence: GeofenceResponse;
}>();

const center = computed<[number, number]>(() => [
  props.geofence.center.lat,
  props.geofence.center.lng,
]);

const color = computed(() => props.geofence.color || '#3B82F6');
const radius = computed(() => props.geofence.radius_m);
</script>

<template>
  <div class="geofence-overlay" :data-geofence-id="geofence.id">
    <!-- Rendered by LiveMap using Leaflet circle API -->
    <slot
      :center="center"
      :radius="radius"
      :color="color"
      :name="geofence.name"
    />
  </div>
</template>
