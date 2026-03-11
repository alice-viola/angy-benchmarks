<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ShipmentTimeline from '@/components/shipments/ShipmentTimeline.vue';
import ShipmentTransitionActions from '@/components/shipments/ShipmentTransitionActions.vue';
import { useShipmentStore } from '@/stores/shipment.store';

const route = useRoute();
const store = useShipmentStore();
const id = route.params.id as string;

onMounted(() => {
  store.fetchOne(id);
});

async function onTransitioned() {
  await store.fetchOne(id);
}
</script>

<template>
  <div v-if="store.currentShipment">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-slate-900">
          {{ store.currentShipment.reference_code || 'Shipment' }}
        </h1>
        <StatusBadge :status="store.currentShipment.status" />
      </div>
      <ShipmentTransitionActions
        :shipment-id="id"
        :current-state="store.currentShipment.status"
        @transitioned="onTransitioned"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Pickup Card -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-2">Pickup</h3>
        <p class="text-slate-900">{{ store.currentShipment.origin_address }}</p>
        <p class="text-xs text-slate-400 mt-1">{{ store.currentShipment.origin_lat }}, {{ store.currentShipment.origin_lng }}</p>
        <p v-if="store.currentShipment.scheduled_pickup_at" class="text-sm text-slate-600 mt-2">
          Scheduled: {{ new Date(store.currentShipment.scheduled_pickup_at).toLocaleString() }}
        </p>
      </div>
      <!-- Delivery Card -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-2">Delivery</h3>
        <p class="text-slate-900">{{ store.currentShipment.dest_address }}</p>
        <p class="text-xs text-slate-400 mt-1">{{ store.currentShipment.dest_lat }}, {{ store.currentShipment.dest_lng }}</p>
        <p v-if="store.currentShipment.scheduled_delivery_at" class="text-sm text-slate-600 mt-2">
          Scheduled: {{ new Date(store.currentShipment.scheduled_delivery_at).toLocaleString() }}
        </p>
      </div>
      <!-- Cargo Card -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-2">Cargo</h3>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span class="text-slate-500">Weight:</span>
            <span class="ml-1 text-slate-900">{{ store.currentShipment.cargo_weight_kg ?? '-' }} kg</span>
          </div>
          <div>
            <span class="text-slate-500">Volume:</span>
            <span class="ml-1 text-slate-900">{{ store.currentShipment.cargo_volume_m3 ?? '-' }} m³</span>
          </div>
        </div>
      </div>
      <!-- Assignment Card -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-2">Assignment</h3>
        <div class="text-sm space-y-1">
          <p>
            <span class="text-slate-500">Driver:</span>
            <span class="ml-1 text-slate-900">
              {{ store.currentShipment.assigned_driver ? `${store.currentShipment.assigned_driver.first_name} ${store.currentShipment.assigned_driver.last_name}` : 'Unassigned' }}
            </span>
          </p>
          <p>
            <span class="text-slate-500">Vehicle:</span>
            <span class="ml-1 text-slate-900">{{ store.currentShipment.assigned_vehicle?.registration ?? 'Unassigned' }}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div v-if="store.currentShipment.notes" class="bg-white rounded-lg border border-slate-200 p-4 mb-6">
      <h3 class="text-sm font-medium text-slate-500 mb-2">Notes</h3>
      <p class="text-sm text-slate-700">{{ store.currentShipment.notes }}</p>
    </div>

    <!-- Timeline -->
    <div class="bg-white rounded-lg border border-slate-200 p-4">
      <h3 class="text-sm font-medium text-slate-500 mb-4">Timeline</h3>
      <ShipmentTimeline :events="store.currentShipment.events ?? []" />
    </div>
  </div>
  <div v-else-if="store.loading" class="animate-pulse space-y-4">
    <div class="h-8 bg-slate-200 rounded w-1/3"></div>
    <div class="h-32 bg-slate-200 rounded"></div>
  </div>
</template>
