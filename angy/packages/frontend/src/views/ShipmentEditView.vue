<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ShipmentForm from '@/components/shipments/ShipmentForm.vue';
import { useShipmentStore } from '@/stores/shipment.store';
import type { CreateShipmentInput } from '@nexus-fleet/shared';

const route = useRoute();
const router = useRouter();
const store = useShipmentStore();
const id = route.params.id as string;

onMounted(() => {
  store.fetchOne(id);
});

const initialValues = computed(() => {
  if (!store.currentShipment) return undefined;
  const s = store.currentShipment;
  return {
    customer_name: s.customer_name,
    origin_address: s.origin_address,
    origin_lat: s.origin_lat,
    origin_lng: s.origin_lng,
    dest_address: s.dest_address,
    dest_lat: s.dest_lat,
    dest_lng: s.dest_lng,
    scheduled_pickup_at: s.scheduled_pickup_at ?? undefined,
    scheduled_delivery_at: s.scheduled_delivery_at ?? undefined,
    cargo_description: s.cargo_description ?? undefined,
    cargo_weight_kg: s.cargo_weight_kg,
    cargo_volume_m3: s.cargo_volume_m3,
  };
});

async function onSubmit(values: CreateShipmentInput) {
  await store.update(id, values);
  router.push(`/shipments/${id}`);
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Edit Shipment</h1>
    <div v-if="store.currentShipment && initialValues" class="max-w-2xl">
      <ShipmentForm :initial-values="initialValues" submit-label="Update Shipment" @submit="onSubmit" />
    </div>
    <div v-else-if="store.loading" class="animate-pulse">
      <div class="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
      <div class="h-96 bg-slate-200 rounded"></div>
    </div>
  </div>
</template>
