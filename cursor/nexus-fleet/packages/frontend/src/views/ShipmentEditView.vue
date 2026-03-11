<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ShipmentForm from '@/components/shipments/ShipmentForm.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useShipmentStore } from '@/stores/shipments'
import type { UpdateShipmentInput } from '@nexus-fleet/shared'

const route = useRoute()
const router = useRouter()
const shipmentStore = useShipmentStore()

const shipmentId = computed(() => route.params.id as string)
const shipment = computed(() => shipmentStore.currentShipment)
const loading = ref(true)

async function loadShipment() {
  loading.value = true
  try {
    await shipmentStore.fetchShipment(shipmentId.value)
  } finally {
    loading.value = false
  }
}

async function handleSubmit(data: Record<string, unknown>) {
  const input: UpdateShipmentInput = {
    customerName: data.customerName as string,
    priority: data.priority as any,
    cargoDescription: (data.cargoDescription as string) || undefined,
    weightKg: data.cargoWeightKg as number,
    volumeM3: data.cargoVolumeM3 as number | undefined,
    cargoType: data.cargoType as any,
    pickupAddress: {
      street: data.originAddress as string,
      lat: data.originLat as number,
      lng: data.originLng as number,
    },
    deliveryAddress: {
      street: data.destAddress as string,
      lat: data.destLat as number,
      lng: data.destLng as number,
    },
    scheduledPickup: data.scheduledPickupAt as string,
  }

  const updated = await shipmentStore.updateShipment(shipmentId.value, input)
  if (updated) {
    router.push({ name: 'ShipmentDetail', params: { id: shipmentId.value } })
  }
}

function handleCancel() {
  router.push({ name: 'ShipmentDetail', params: { id: shipmentId.value } })
}

onMounted(loadShipment)
watch(shipmentId, loadShipment)
</script>

<template>
  <AppLayout>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Not found -->
    <div v-else-if="!shipment" class="flex flex-col items-center justify-center py-20">
      <svg class="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
      <h2 class="mt-4 text-lg font-semibold text-gray-900">Shipment not found</h2>
      <p class="mt-1 text-sm text-gray-500">The shipment you're trying to edit doesn't exist.</p>
      <RouterLink to="/shipments" class="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700">
        Back to shipments
      </RouterLink>
    </div>

    <!-- Edit form -->
    <div v-else class="mx-auto max-w-4xl space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 transition-colors"
          @click="handleCancel"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Edit Shipment</h1>
          <p class="mt-1 text-sm text-gray-500">
            Editing <span class="font-medium">{{ shipment.referenceCode }}</span>
          </p>
        </div>
      </div>

      <!-- Form card -->
      <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <ShipmentForm
          mode="edit"
          :shipment="shipment"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>
  </AppLayout>
</template>
