<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useShipmentsStore } from '@/stores/shipments';
import AppLayout from '@/layouts/AppLayout.vue';
import ShipmentForm from '@/components/shipments/ShipmentForm.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

const route = useRoute();
const router = useRouter();
const shipmentsStore = useShipmentsStore();

const shipmentId = route.params.id as string;
const saving = ref(false);

async function handleSubmit(data: any) {
  saving.value = true;
  try {
    const response = await shipmentsStore.updateShipment(shipmentId, data);
    if (response?.success) {
      router.push(`/shipments/${shipmentId}`);
    }
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  shipmentsStore.fetchShipment(shipmentId);
});
</script>

<template>
  <AppLayout>
    <div class="max-w-4xl">
      <div class="page-header">
        <div class="flex items-center gap-3">
          <button class="p-1 text-gray-400 hover:text-gray-600" @click="router.back()">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 class="page-title">Edit Shipment</h1>
        </div>
      </div>

      <div v-if="shipmentsStore.loading && !shipmentsStore.currentShipment" class="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>

      <ShipmentForm
        v-else
        :shipment="shipmentsStore.currentShipment"
        :loading="saving"
        @submit="handleSubmit"
        @cancel="router.back()"
      />
    </div>
  </AppLayout>
</template>
