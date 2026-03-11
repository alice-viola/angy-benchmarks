<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { SHIPMENT_TRANSITIONS } from '@nexus-fleet/shared';
import type { ShipmentState } from '@nexus-fleet/shared';
import { useShipmentStore } from '@/stores/shipment.store';
import { api } from '@/plugins/axios';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';

const props = defineProps<{
  shipmentId: string;
  currentState: string;
}>();

const emit = defineEmits<{
  transitioned: [];
}>();

const shipmentStore = useShipmentStore();

const availableActions = computed(() => {
  return SHIPMENT_TRANSITIONS[props.currentState as ShipmentState] ?? [];
});

// Dialog states
const showAssignDialog = ref(false);
const showDeliverDialog = ref(false);
const showReasonDialog = ref(false);
const showConfirmDialog = ref(false);
const pendingAction = ref('');
const processing = ref(false);

// Assign form
const vehicleOptions = ref<Array<{ id: string; registration: string }>>([]);
const driverOptions = ref<Array<{ id: string; first_name: string; last_name: string }>>([]);
const selectedVehicle = ref('');
const selectedDriver = ref('');

// Reason form
const reasonText = ref('');

// Deliver form
const podNotes = ref('');

onMounted(async () => {
  try {
    const [vRes, dRes] = await Promise.all([
      api.get('/api/v1/vehicles', { params: { status: 'available', limit: 100 } }),
      api.get('/api/v1/drivers', { params: { status: 'available', limit: 100 } }),
    ]);
    vehicleOptions.value = vRes.data.data ?? [];
    driverOptions.value = dRes.data.data ?? [];
  } catch {
    // silent
  }
});

function onAction(action: string) {
  pendingAction.value = action;
  if (action === 'assign') {
    selectedVehicle.value = '';
    selectedDriver.value = '';
    showAssignDialog.value = true;
  } else if (action === 'deliver') {
    podNotes.value = '';
    showDeliverDialog.value = true;
  } else if (action === 'fail' || action === 'cancel') {
    reasonText.value = '';
    showReasonDialog.value = true;
  } else {
    showConfirmDialog.value = true;
  }
}

async function executeAction(data?: Record<string, unknown>) {
  processing.value = true;
  try {
    await shipmentStore.transition(props.shipmentId, pendingAction.value, data);
    closeAllDialogs();
    emit('transitioned');
  } catch {
    // error handled by store
  } finally {
    processing.value = false;
  }
}

function confirmAssign() {
  executeAction({
    vehicle_id: selectedVehicle.value || undefined,
    driver_id: selectedDriver.value || undefined,
  });
}

function confirmDeliver() {
  executeAction({ notes: podNotes.value || undefined });
}

function confirmReason() {
  executeAction({ notes: reasonText.value || undefined });
}

function closeAllDialogs() {
  showAssignDialog.value = false;
  showDeliverDialog.value = false;
  showReasonDialog.value = false;
  showConfirmDialog.value = false;
}

const actionStyles: Record<string, string> = {
  confirm: 'bg-blue-600 hover:bg-blue-700 text-white',
  assign: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  pickup: 'bg-purple-600 hover:bg-purple-700 text-white',
  deliver: 'bg-green-600 hover:bg-green-700 text-white',
  complete: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  fail: 'bg-red-600 hover:bg-red-700 text-white',
  cancel: 'bg-gray-600 hover:bg-gray-700 text-white',
};

function formatAction(action: string): string {
  return action.replace(/\b\w/g, c => c.toUpperCase());
}
</script>

<template>
  <div class="flex gap-2 flex-wrap">
    <button
      v-for="action in availableActions"
      :key="action"
      class="px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50"
      :class="actionStyles[action] || 'bg-slate-600 hover:bg-slate-700 text-white'"
      :disabled="processing"
      @click="onAction(action)"
    >
      {{ formatAction(action) }}
    </button>
  </div>

  <!-- Assign Dialog -->
  <Teleport to="body">
    <div v-if="showAssignDialog" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closeAllDialogs" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">Assign Shipment</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Vehicle</label>
            <select v-model="selectedVehicle" class="w-full px-3 py-2 border border-slate-300 rounded-md">
              <option value="">Select vehicle...</option>
              <option v-for="v in vehicleOptions" :key="v.id" :value="v.id">{{ v.registration }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Driver</label>
            <select v-model="selectedDriver" class="w-full px-3 py-2 border border-slate-300 rounded-md">
              <option value="">Select driver...</option>
              <option v-for="d in driverOptions" :key="d.id" :value="d.id">{{ d.first_name }} {{ d.last_name }}</option>
            </select>
          </div>
        </div>
        <div class="mt-6 flex justify-end space-x-3">
          <button class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200" @click="closeAllDialogs">Cancel</button>
          <button class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50" :disabled="processing" @click="confirmAssign">Assign</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Deliver Dialog -->
  <Teleport to="body">
    <div v-if="showDeliverDialog" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closeAllDialogs" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">Mark as Delivered</h3>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">POD Notes</label>
          <textarea v-model="podNotes" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-md" placeholder="Delivery notes..." />
        </div>
        <div class="mt-6 flex justify-end space-x-3">
          <button class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200" @click="closeAllDialogs">Cancel</button>
          <button class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50" :disabled="processing" @click="confirmDeliver">Deliver</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Reason Dialog (fail/cancel) -->
  <Teleport to="body">
    <div v-if="showReasonDialog" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closeAllDialogs" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">{{ formatAction(pendingAction) }} Shipment</h3>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Reason</label>
          <textarea v-model="reasonText" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-md" placeholder="Enter reason..." />
        </div>
        <div class="mt-6 flex justify-end space-x-3">
          <button class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200" @click="closeAllDialogs">Cancel</button>
          <button class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50" :disabled="processing" @click="confirmReason">Confirm</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Simple Confirm Dialog -->
  <ConfirmDialog
    :open="showConfirmDialog"
    :title="`${formatAction(pendingAction)} Shipment`"
    :message="`Are you sure you want to ${pendingAction} this shipment?`"
    @confirm="executeAction()"
    @cancel="closeAllDialogs"
  />
</template>
