<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  vehicle: {
    id: string;
    lat: number;
    lng: number;
    heading?: number | null;
    status?: string;
    registration?: string;
    speed_kmh?: number | null;
  };
}>();

const emit = defineEmits<{
  click: [vehicle: typeof props.vehicle];
}>();

const statusColor = computed(() => {
  const map: Record<string, string> = {
    in_transit: '#3B5FEE',
    available: '#10B981',
    maintenance: '#F59E0B',
    idle: '#94A3B8',
  };
  return map[props.vehicle.status || ''] || '#94A3B8';
});

const rotation = computed(() => props.vehicle.heading ?? 0);

const svgIcon = computed(() => {
  const color = statusColor.value;
  return `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation.value}deg)">
    <circle cx="14" cy="14" r="12" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>
    <path d="M14 6 L20 18 L14 15 L8 18 Z" fill="${color}"/>
  </svg>`;
});
</script>

<template>
  <div
    class="vehicle-marker cursor-pointer"
    :title="vehicle.registration || vehicle.id"
    @click="emit('click', vehicle)"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-html="svgIcon" />
  </div>
</template>

<style scoped>
.vehicle-marker {
  transition: transform 1s ease-in-out;
}
</style>
