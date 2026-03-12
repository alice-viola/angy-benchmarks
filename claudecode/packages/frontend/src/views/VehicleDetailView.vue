<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVehiclesStore } from '@/stores/vehicles';
import { useTrackingStore } from '@/stores/tracking';
import AppLayout from '@/layouts/AppLayout.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import LiveMap from '@/components/map/LiveMap.vue';

const route = useRoute();
const router = useRouter();
const vehiclesStore = useVehiclesStore();
const trackingStore = useTrackingStore();

const vehicleId = route.params.id as string;
const vehicle = computed(() => vehiclesStore.currentVehicle);
const position = computed(() => trackingStore.getVehiclePosition(vehicleId));

onMounted(() => {
  vehiclesStore.fetchVehicle(vehicleId);
});
</script>

<template>
  <AppLayout>
    <div v-if="vehiclesStore.loading && !vehicle" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="vehicle" class="space-y-6">
      <div class="page-header">
        <div class="flex items-center gap-3">
          <button class="p-1 text-gray-400 hover:text-gray-600" @click="router.back()">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 class="page-title">{{ vehicle.registration }}</h1>
            <p class="text-sm text-gray-500">{{ vehicle.make }} {{ vehicle.model }} ({{ vehicle.year }})</p>
          </div>
        </div>
        <StatusBadge :status="vehicle.status" type="vehicle" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Vehicle info -->
        <div class="space-y-6">
          <div class="card">
            <h3 class="text-sm font-semibold text-gray-900 mb-4">Vehicle Info</h3>
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between">
                <dt class="text-gray-500">VIN</dt>
                <dd class="font-mono text-gray-900">{{ vehicle.vin }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Type</dt>
                <dd class="capitalize text-gray-900">{{ vehicle.type }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Capacity</dt>
                <dd class="text-gray-900">{{ vehicle.capacity_kg }} kg / {{ vehicle.capacity_m3 }} m&sup3;</dd>
              </div>
            </dl>
          </div>

          <div v-if="position" class="card">
            <h3 class="text-sm font-semibold text-gray-900 mb-4">Current Position</h3>
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between">
                <dt class="text-gray-500">Speed</dt>
                <dd class="text-gray-900">{{ position.speed_kmh.toFixed(1) }} km/h</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Heading</dt>
                <dd class="text-gray-900">{{ position.heading.toFixed(0) }}&deg;</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Last Update</dt>
                <dd class="text-gray-900">{{ new Date(position.timestamp).toLocaleTimeString() }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Map -->
        <div class="lg:col-span-2">
          <LiveMap
            height="500px"
            :track-vehicle-id="vehicleId"
            :show-geofences="true"
            :center="position ? [position.lat, position.lng] : undefined"
            :zoom="14"
          />
        </div>
      </div>
    </div>
  </AppLayout>
</template>
