<script setup lang="ts">
import { computed } from 'vue';
import { LMarker, LPopup } from '@vue-leaflet/vue-leaflet';

const props = defineProps<{
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
  registration?: string;
}>();

const emit = defineEmits<{
  track: [vehicleId: string];
}>();

const position = computed<[number, number]>(() => [props.lat, props.lng]);

const lastUpdate = computed(() => {
  const diff = Date.now() - new Date(props.timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
});
</script>

<template>
  <LMarker :lat-lng="position">
    <LPopup>
      <div class="text-sm min-w-[160px]">
        <p class="font-semibold">{{ registration || vehicleId }}</p>
        <p class="text-slate-600">Speed: {{ speed }} km/h</p>
        <p class="text-slate-600">Heading: {{ heading }}&deg;</p>
        <p class="text-slate-400 text-xs">Updated {{ lastUpdate }}</p>
        <button
          class="mt-2 text-xs text-blue-600 hover:underline"
          @click="emit('track', vehicleId)"
        >
          Track Vehicle
        </button>
      </div>
    </LPopup>
  </LMarker>
</template>
