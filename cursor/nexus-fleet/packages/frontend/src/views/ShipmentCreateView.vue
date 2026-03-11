<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ShipmentForm from '@/components/shipments/ShipmentForm.vue'
import { useShipmentStore } from '@/stores/shipments'
import type { CreateShipmentInput } from '@nexus-fleet/shared'

const router = useRouter()
const shipmentStore = useShipmentStore()

async function handleSubmit(data: Record<string, unknown>) {
  const input: CreateShipmentInput = {
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

  const shipment = await shipmentStore.createShipment(input)
  if (shipment) {
    router.push({ name: 'ShipmentDetail', params: { id: shipment.id } })
  }
}

function handleCancel() {
  router.back()
}
</script>

<template>
  <AppLayout>
    <div class="mx-auto max-w-4xl space-y-6">
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
          <h1 class="text-2xl font-bold text-gray-900">Create New Shipment</h1>
          <p class="mt-1 text-sm text-gray-500">Fill in the details below to create a new shipment</p>
        </div>
      </div>

      <!-- Form card -->
      <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <ShipmentForm
          mode="create"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>
  </AppLayout>
</template>
