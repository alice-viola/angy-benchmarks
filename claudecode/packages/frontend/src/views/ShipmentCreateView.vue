<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useShipmentsStore } from '@/stores/shipments';
import AppLayout from '@/layouts/AppLayout.vue';
import ShipmentForm from '@/components/shipments/ShipmentForm.vue';

const router = useRouter();
const shipmentsStore = useShipmentsStore();
const loading = ref(false);

async function handleSubmit(data: any) {
  loading.value = true;
  try {
    const response = await shipmentsStore.createShipment(data);
    if (response?.success) {
      router.push(`/shipments/${(response.data as any).id}`);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AppLayout>
    <div class="max-w-4xl">
      <div class="page-header">
        <h1 class="page-title">New Shipment</h1>
      </div>

      <ShipmentForm
        :loading="loading"
        @submit="handleSubmit"
        @cancel="router.back()"
      />
    </div>
  </AppLayout>
</template>
