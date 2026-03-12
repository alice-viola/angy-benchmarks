<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-vue-next';
import { useGeofenceStore } from '../stores/geofences';
import { useToast } from '../composables/useToast';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import GeofenceDrawer from '../components/geofences/GeofenceDrawer.vue';

const routeInfo = useRoute();
const router = useRouter();
const geofenceStore = useGeofenceStore();
const { addToast } = useToast();

const id = ref(routeInfo.params.id as string);
const error = ref('');
const saving = ref(false);

const geofence = computed(() => geofenceStore.currentGeofence);
const loading = computed(() => geofenceStore.loading);

// Local form state
const name = ref('');
const radiusM = ref(500);
const color = ref('#3B82F6');
const centerLat = ref(40.7128);
const centerLng = ref(-74.006);
const triggerOnEnter = ref(true);
const triggerOnExit = ref(true);

onMounted(async () => {
  try {
    const data = await geofenceStore.fetch(id.value);
    if (data) {
      name.value = data.name;
      radiusM.value = data.radius_m;
      color.value = data.color;
      centerLat.value = data.center.lat;
      centerLng.value = data.center.lng;
      triggerOnEnter.value = data.trigger_on_enter;
      triggerOnExit.value = data.trigger_on_exit;
    }
  } catch {
    error.value = 'Failed to load geofence';
  }
});

function handleCenterUpdate(coords: { lat: number; lng: number }) {
  centerLat.value = coords.lat;
  centerLng.value = coords.lng;
  // Update store so the drawer circle moves
  if (geofenceStore.currentGeofence) {
    geofenceStore.currentGeofence.center = coords;
  }
}

function handleRadiusInput() {
  if (geofenceStore.currentGeofence) {
    geofenceStore.currentGeofence.radius_m = radiusM.value;
  }
}

function handleColorInput() {
  if (geofenceStore.currentGeofence) {
    geofenceStore.currentGeofence.color = color.value;
  }
}

async function handleSave() {
  if (!name.value.trim()) {
    addToast({ type: 'warning', title: 'Please enter a name' });
    return;
  }
  saving.value = true;
  try {
    await geofenceStore.update(id.value, {
      name: name.value,
      center_lat: centerLat.value,
      center_lng: centerLng.value,
      radius_m: radiusM.value,
      color: color.value,
      trigger_on_enter: triggerOnEnter.value,
      trigger_on_exit: triggerOnExit.value,
    });
    addToast({ type: 'success', title: 'Geofence updated' });
    router.push('/geofences');
  } catch {
    addToast({ type: 'error', title: 'Failed to update geofence' });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <RouterLink to="/geofences" class="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 transition-colors mb-3">
        <ArrowLeft class="w-4 h-4" />
        Back to Geofences
      </RouterLink>
      <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">Geofence Editor</h1>
      <p class="text-sm text-neutral-400 mt-1">Edit geofence boundary and settings</p>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 flex items-center gap-3 mb-6">
      <AlertTriangle class="w-4 h-4 text-danger-500 flex-shrink-0" />
      <p class="text-sm text-danger-700">{{ error }}</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Settings panel -->
      <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
        <h2 class="text-base font-medium text-neutral-800 mb-4">Settings</h2>

        <div v-if="loading" class="space-y-4">
          <LoadingSkeleton width="100%" height="36px" />
          <LoadingSkeleton width="100%" height="36px" />
          <LoadingSkeleton width="100%" height="36px" />
        </div>

        <form v-else class="space-y-4" @submit.prevent="handleSave">
          <div>
            <label class="block text-xs font-medium text-neutral-500 mb-1">Name</label>
            <input
              v-model="name"
              type="text"
              placeholder="e.g. Warehouse Zone"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-500 mb-1">Radius (meters)</label>
            <input
              v-model.number="radiusM"
              type="number"
              min="10"
              max="50000"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              @input="handleRadiusInput"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-500 mb-1">Color</label>
            <div class="flex items-center gap-2">
              <input
                v-model="color"
                type="color"
                class="w-10 h-10 rounded-lg border border-neutral-300 cursor-pointer p-0.5"
                @input="handleColorInput"
              />
              <input
                v-model="color"
                type="text"
                class="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                @input="handleColorInput"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-500 mb-2">Center (click map to set)</label>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <span class="text-xs text-neutral-400">Lat</span>
                <p class="text-sm font-mono text-neutral-700">{{ centerLat.toFixed(6) }}</p>
              </div>
              <div>
                <span class="text-xs text-neutral-400">Lng</span>
                <p class="text-sm font-mono text-neutral-700">{{ centerLng.toFixed(6) }}</p>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-xs font-medium text-neutral-500">Triggers</label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="triggerOnEnter" type="checkbox" class="rounded border-neutral-300 text-primary-500 focus:ring-primary-500" />
              <span class="text-sm text-neutral-700">Trigger on enter</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="triggerOnExit" type="checkbox" class="rounded border-neutral-300 text-primary-500 focus:ring-primary-500" />
              <span class="text-sm text-neutral-700">Trigger on exit</span>
            </label>
          </div>

          <button
            type="submit"
            :disabled="saving"
            class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
            <Save v-else class="w-4 h-4" />
            Save Changes
          </button>
        </form>
      </div>

      <!-- Map -->
      <div class="lg:col-span-2 bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
        <h2 class="text-base font-medium text-neutral-800 mb-4">Boundary Editor</h2>
        <div v-if="loading" class="h-96 bg-neutral-100 rounded-lg flex items-center justify-center">
          <Loader2 class="w-6 h-6 text-neutral-400 animate-spin" />
        </div>
        <div v-else class="h-[calc(100vh-320px)] min-h-[400px]">
          <GeofenceDrawer
            :geofence="geofence"
            @update:center="handleCenterUpdate"
          />
        </div>
      </div>
    </div>
  </div>
</template>
