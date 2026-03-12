<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import ShipmentForm from '../components/ShipmentForm.vue';
import { useShipmentStore } from '../stores/shipments';
import { useToast } from '../composables/useToast';
import type { ShipmentRequest } from '@nexusfleet/shared';

const router = useRouter();
const shipmentStore = useShipmentStore();
const { addToast } = useToast();

const submitting = ref(false);
const apiError = ref('');

async function handleSubmit(data: ShipmentRequest) {
  submitting.value = true;
  apiError.value = '';
  try {
    const shipment = await shipmentStore.create(data);
    addToast({
      type: 'success',
      title: 'Shipment created',
      message: 'Your shipment has been created as a draft.',
    });
    router.push({ name: 'shipment-detail', params: { id: shipment.id } });
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
      'Failed to create shipment. Please try again.';
    apiError.value = message;
    addToast({
      type: 'error',
      title: 'Creation failed',
      message,
    });
  } finally {
    submitting.value = false;
  }
}

function handleCancel() {
  router.push({ name: 'shipments' });
}
</script>

<template>
  <div>
    <div class="mb-6">
      <RouterLink
        to="/shipments"
        class="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 transition-colors mb-3"
      >
        <ArrowLeft class="w-4 h-4" />
        Back to Shipments
      </RouterLink>
      <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">Create Shipment</h1>
      <p class="text-sm text-neutral-400 mt-1">Fill in the details to create a new shipment</p>
    </div>

    <!-- API error banner -->
    <div
      v-if="apiError"
      class="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 flex items-center gap-3 mb-6"
    >
      <span class="text-sm text-danger-700">{{ apiError }}</span>
      <button
        class="ml-auto text-danger-400 hover:text-danger-600"
        @click="apiError = ''"
      >
        &times;
      </button>
    </div>

    <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
      <ShipmentForm
        :submitting="submitting"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>
