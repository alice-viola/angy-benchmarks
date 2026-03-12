<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  coordinates: Array<[number, number]>; // [lat, lng] pairs
  color?: string;
  dashed?: boolean;
  weight?: number;
}>();

const polylineColor = computed(() => props.color || '#3B5FEE');
const polylineWeight = computed(() => props.weight || 3);
const dashArray = computed(() => (props.dashed ? '8, 8' : undefined));
const latLngs = computed(() => props.coordinates);
</script>

<template>
  <div
    class="route-polyline"
    :data-points="latLngs.length"
  >
    <!-- Rendered by LiveMap using Leaflet polyline API -->
    <slot
      :lat-lngs="latLngs"
      :color="polylineColor"
      :weight="polylineWeight"
      :dash-array="dashArray"
    />
  </div>
</template>
