<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { geofenceCreateSchema } from '@nexus-fleet/shared';
import type { Geofence } from '@/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const props = defineProps<{
  geofence?: Geofence | null;
}>();

const emit = defineEmits<{
  save: [data: {
    name: string;
    center_lat: number;
    center_lng: number;
    radius_m: number;
    color: string;
    trigger_on_enter: boolean;
    trigger_on_exit: boolean;
  }];
  cancel: [];
}>();

const schema = toTypedSchema(geofenceCreateSchema);
const { handleSubmit, errors, setFieldValue } = useForm({
  validationSchema: schema,
  initialValues: props.geofence
    ? {
        name: props.geofence.name,
        center_lat: props.geofence.center_lat,
        center_lng: props.geofence.center_lng,
        radius_m: props.geofence.radius_m,
        color: props.geofence.color,
        trigger_on_enter: props.geofence.trigger_on_enter,
        trigger_on_exit: props.geofence.trigger_on_exit,
      }
    : {
        name: '',
        center_lat: 51.505,
        center_lng: -0.09,
        radius_m: 500,
        color: '#3B82F6',
        trigger_on_enter: true,
        trigger_on_exit: true,
      },
});

const { value: name } = useField<string>('name');
const { value: center_lat } = useField<number>('center_lat');
const { value: center_lng } = useField<number>('center_lng');
const { value: radius_m } = useField<number>('radius_m');
const { value: color } = useField<string>('color');
const { value: trigger_on_enter } = useField<boolean>('trigger_on_enter');
const { value: trigger_on_exit } = useField<boolean>('trigger_on_exit');

const mapContainer = ref<HTMLDivElement>();
let map: L.Map | null = null;
let circle: L.Circle | null = null;
let centerMarker: L.Marker | null = null;

function updateCircle() {
  if (!map) return;

  const lat = center_lat.value;
  const lng = center_lng.value;
  const r = radius_m.value;

  if (circle) {
    circle.setLatLng([lat, lng]);
    circle.setRadius(r);
    circle.setStyle({ color: color.value, fillColor: color.value });
  } else {
    circle = L.circle([lat, lng], {
      radius: r,
      color: color.value,
      fillColor: color.value,
      fillOpacity: 0.2,
      weight: 2,
    }).addTo(map);
  }

  if (centerMarker) {
    centerMarker.setLatLng([lat, lng]);
  } else {
    centerMarker = L.marker([lat, lng], { draggable: true }).addTo(map);

    centerMarker.on('dragend', () => {
      const pos = centerMarker!.getLatLng();
      setFieldValue('center_lat', pos.lat);
      setFieldValue('center_lng', pos.lng);
    });
  }
}

const onSubmit = handleSubmit((values) => {
  emit('save', values as any);
});

onMounted(() => {
  if (!mapContainer.value) return;

  map = L.map(mapContainer.value).setView([center_lat.value, center_lng.value], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // Click to set center
  map.on('click', (e: L.LeafletMouseEvent) => {
    setFieldValue('center_lat', e.latlng.lat);
    setFieldValue('center_lng', e.latlng.lng);
  });

  updateCircle();
});

watch([center_lat, center_lng, radius_m, color], () => {
  updateCircle();
});

onUnmounted(() => {
  map?.remove();
  map = null;
});
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Map -->
    <div class="order-2 lg:order-1">
      <div ref="mapContainer" class="h-[500px] w-full rounded-xl border border-gray-200" />
      <p class="mt-2 text-xs text-gray-500">Click on the map to set the center. Drag the marker to reposition.</p>
    </div>

    <!-- Form -->
    <div class="order-1 lg:order-2">
      <form @submit.prevent="onSubmit" class="space-y-4">
        <div>
          <label class="label">Name</label>
          <input v-model="name" type="text" class="input" :class="{ 'input-error': errors.name }" placeholder="Geofence name" />
          <p v-if="errors.name" class="mt-1 text-xs text-danger-500">{{ errors.name }}</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Latitude</label>
            <input v-model.number="center_lat" type="number" step="any" class="input" :class="{ 'input-error': errors.center_lat }" />
            <p v-if="errors.center_lat" class="mt-1 text-xs text-danger-500">{{ errors.center_lat }}</p>
          </div>
          <div>
            <label class="label">Longitude</label>
            <input v-model.number="center_lng" type="number" step="any" class="input" :class="{ 'input-error': errors.center_lng }" />
            <p v-if="errors.center_lng" class="mt-1 text-xs text-danger-500">{{ errors.center_lng }}</p>
          </div>
        </div>

        <div>
          <label class="label">Radius (meters)</label>
          <input v-model.number="radius_m" type="number" min="1" class="input" :class="{ 'input-error': errors.radius_m }" />
          <p v-if="errors.radius_m" class="mt-1 text-xs text-danger-500">{{ errors.radius_m }}</p>
        </div>

        <div>
          <label class="label">Color</label>
          <div class="flex items-center gap-3">
            <input v-model="color" type="color" class="h-10 w-14 cursor-pointer rounded border border-gray-300" />
            <input v-model="color" type="text" class="input flex-1" placeholder="#3B82F6" />
          </div>
          <p v-if="errors.color" class="mt-1 text-xs text-danger-500">{{ errors.color }}</p>
        </div>

        <div class="space-y-2">
          <label class="label">Triggers</label>
          <label class="flex items-center gap-2">
            <input v-model="trigger_on_enter" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span class="text-sm text-gray-700">Trigger on enter</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="trigger_on_exit" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span class="text-sm text-gray-700">Trigger on exit</span>
          </label>
        </div>

        <div class="flex items-center gap-3 pt-4">
          <button type="submit" class="btn-primary">Save Geofence</button>
          <button type="button" class="btn-secondary" @click="emit('cancel')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>
