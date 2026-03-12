<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useShipmentsStore } from '@/stores/shipments';
import { SHIPMENT_TRANSITIONS } from '@nexus-fleet/shared';
import type { ShipmentStatus } from '@nexus-fleet/shared';
import AppLayout from '@/layouts/AppLayout.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ShipmentTimeline from '@/components/shipments/ShipmentTimeline.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import Modal from '@/components/common/Modal.vue';

const route = useRoute();
const router = useRouter();
const shipmentsStore = useShipmentsStore();

const shipmentId = route.params.id as string;
const transitioning = ref(false);
const confirmModal = ref(false);
const pendingAction = ref('');

const shipment = computed(() => shipmentsStore.currentShipment);

const actionMap: Record<string, { label: string; toStatus: ShipmentStatus; style: string }> = {
  confirm: { label: 'Confirm', toStatus: 'confirmed', style: 'btn-primary' },
  assign: { label: 'Assign', toStatus: 'assigned', style: 'btn-primary' },
  pickup: { label: 'Mark Picked Up', toStatus: 'picked_up', style: 'btn-primary' },
  deliver: { label: 'Mark Delivered', toStatus: 'delivered', style: 'btn-success' },
  fail: { label: 'Mark Failed', toStatus: 'failed', style: 'btn-danger' },
  complete: { label: 'Complete', toStatus: 'completed', style: 'btn-success' },
  cancel: { label: 'Cancel', toStatus: 'cancelled', style: 'btn-danger' },
};

const availableActions = computed(() => {
  if (!shipment.value) return [];
  const current = shipment.value.status;
  return Object.entries(actionMap)
    .filter(([_, info]) => SHIPMENT_TRANSITIONS[`${current}:${info.toStatus}`])
    .map(([action, info]) => ({ action, ...info }));
});

function initiateTransition(action: string) {
  pendingAction.value = action;
  if (['cancel', 'fail'].includes(action)) {
    confirmModal.value = true;
  } else {
    executeTransition(action);
  }
}

async function executeTransition(action: string) {
  confirmModal.value = false;
  transitioning.value = true;
  try {
    await shipmentsStore.transitionShipment(shipmentId, { action: action as any });
    await shipmentsStore.fetchEvents(shipmentId);
  } finally {
    transitioning.value = false;
  }
}

function formatDate(date?: string): string {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

onMounted(() => {
  shipmentsStore.fetchShipment(shipmentId);
});
</script>

<template>
  <AppLayout>
    <div v-if="shipmentsStore.loading && !shipment" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="shipment" class="space-y-6">
      <!-- Header -->
      <div class="page-header">
        <div class="flex items-center gap-3">
          <button class="p-1 text-gray-400 hover:text-gray-600" @click="router.back()">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 class="page-title">{{ shipment.reference_code }}</h1>
            <div class="flex items-center gap-2 mt-1">
              <StatusBadge :status="shipment.status" type="shipment" />
              <StatusBadge :status="shipment.priority" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <router-link :to="`/shipments/${shipmentId}/edit`" class="btn-secondary">
            Edit
          </router-link>
          <button
            v-for="action in availableActions"
            :key="action.action"
            :class="[action.style, 'btn-sm']"
            :disabled="transitioning"
            @click="initiateTransition(action.action)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Info cards -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Customer & cargo -->
          <div class="card">
            <h3 class="text-sm font-semibold text-gray-900 mb-4">Shipment Details</h3>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-gray-500">Customer</dt>
                <dd class="font-medium text-gray-900">{{ shipment.customer_name }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Cargo Type</dt>
                <dd class="font-medium text-gray-900 capitalize">{{ shipment.cargo_type }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Origin</dt>
                <dd class="text-gray-900">{{ shipment.origin_address }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Destination</dt>
                <dd class="text-gray-900">{{ shipment.dest_address }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Weight</dt>
                <dd class="font-medium text-gray-900">{{ shipment.cargo_weight_kg }} kg</dd>
              </div>
              <div>
                <dt class="text-gray-500">Volume</dt>
                <dd class="font-medium text-gray-900">{{ shipment.cargo_volume_m3 }} m&sup3;</dd>
              </div>
              <div>
                <dt class="text-gray-500">Description</dt>
                <dd class="text-gray-900">{{ shipment.cargo_description }}</dd>
              </div>
              <div v-if="shipment.requires_temp_control">
                <dt class="text-gray-500">Temperature</dt>
                <dd class="font-medium text-gray-900">{{ shipment.temp_min_c }}&deg;C - {{ shipment.temp_max_c }}&deg;C</dd>
              </div>
            </dl>
          </div>

          <!-- Dates -->
          <div class="card">
            <h3 class="text-sm font-semibold text-gray-900 mb-4">Schedule</h3>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-gray-500">Scheduled Pickup</dt>
                <dd class="text-gray-900">{{ formatDate(shipment.scheduled_pickup_at) }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Actual Pickup</dt>
                <dd class="text-gray-900">{{ formatDate(shipment.actual_pickup_at) }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Actual Delivery</dt>
                <dd class="text-gray-900">{{ formatDate(shipment.actual_delivery_at) }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Created</dt>
                <dd class="text-gray-900">{{ formatDate(shipment.created_at) }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Timeline -->
        <div class="card">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Timeline</h3>
          <ShipmentTimeline :shipment-id="shipmentId" />
        </div>
      </div>
    </div>

    <!-- Confirm modal -->
    <Modal :open="confirmModal" title="Confirm Action" @close="confirmModal = false">
      <p class="text-sm text-gray-600">
        Are you sure you want to <strong>{{ pendingAction }}</strong> this shipment? This action cannot be undone.
      </p>
      <template #footer>
        <button class="btn-secondary" @click="confirmModal = false">Cancel</button>
        <button class="btn-danger" @click="executeTransition(pendingAction)">Confirm</button>
      </template>
    </Modal>
  </AppLayout>
</template>
