<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { LMap, LTileLayer, LCircle } from '@vue-leaflet/vue-leaflet';
import GeofenceDrawer from '@/components/geofences/GeofenceDrawer.vue';
import { useGeofenceStore } from '@/stores/geofence.store';

const router = useRouter();
const store = useGeofenceStore();

const name = ref('');
const description = ref('');
const centerLat = ref(40);
const centerLng = ref(-95);
const radiusM = ref(500);
const triggerOnEnter = ref(true);
const triggerOnExit = ref(true);
const saving = ref(false);

const drawerRef = ref<InstanceType<typeof GeofenceDrawer> | null>(null);

function onMapClick(event: { latlng?: { lat: number; lng: number } }) {
  if (event.latlng) {
    centerLat.value = event.latlng.lat;
    centerLng.value = event.latlng.lng;
  }
}

async function save() {
  saving.value = true;
  try {
    await store.create({
      name: name.value,
      description: description.value || undefined,
      type: 'circle',
      center_latitude: centerLat.value,
      center_longitude: centerLng.value,
      radius_meters: radiusM.value,
      trigger_on_enter: triggerOnEnter.value,
      trigger_on_exit: triggerOnExit.value,
    });
    router.push('/geofences');
  } catch {
    // error handled in store
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-6" style="min-height: 600px;">
    <div class="lg:flex-1">
      <LMap :zoom="5" :center="[centerLat, centerLng]" :use-global-leaflet="false" class="w-full h-full min-h-[400px] rounded-lg border border-slate-200" @click="onMapClick">
        <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <LCircle :lat-lng="[centerLat, centerLng]" :radius="radiusM" color="#3b82f6" :fill-opacity="0.15" />
      </LMap>
    </div>
    <div class="lg:w-80 space-y-4">
      <h2 class="text-lg font-semibold text-slate-900">New Geofence</h2>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Name</label>
        <input v-model="name" type="text" class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea v-model="description" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <GeofenceDrawer ref="drawerRef" :center-lat="centerLat" :center-lng="centerLng" :radius-m="radiusM"
        @update:center-lat="centerLat = $event" @update:center-lng="centerLng = $event" @update:radius-m="radiusM = $event" />
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm">
          <input v-model="triggerOnEnter" type="checkbox" class="rounded border-slate-300" />
          Trigger on Enter
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="triggerOnExit" type="checkbox" class="rounded border-slate-300" />
          Trigger on Exit
        </label>
      </div>
      <button :disabled="!name || saving" @click="save"
        class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
        {{ saving ? 'Saving...' : 'Save Geofence' }}
      </button>
    </div>
  </div>
</template>
