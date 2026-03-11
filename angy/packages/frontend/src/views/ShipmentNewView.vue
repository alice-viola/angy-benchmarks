<script setup lang="ts">
import { useRouter } from 'vue-router';
import ShipmentForm from '@/components/shipments/ShipmentForm.vue';
import { useShipmentStore } from '@/stores/shipment.store';
import type { CreateShipmentInput } from '@nexus-fleet/shared';

const router = useRouter();
const store = useShipmentStore();

async function onSubmit(values: CreateShipmentInput) {
  const shipment = await store.create(values);
  router.push(`/shipments/${shipment.id}`);
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Create Shipment</h1>
    <div class="max-w-2xl">
      <ShipmentForm @submit="onSubmit" />
    </div>
  </div>
</template>
