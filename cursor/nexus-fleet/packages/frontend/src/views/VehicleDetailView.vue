<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVehicleStore } from '../stores/vehicles'
import { useDriverStore } from '../stores/drivers'
import { useShipmentStore } from '../stores/shipments'
import { useTrackingStore } from '../stores/tracking'
import type { UpdateVehicleInput } from '@nexus-fleet/shared'
import { VEHICLE_STATUSES } from '@nexus-fleet/shared'
import AppLayout from '../layouts/AppLayout.vue'
import LiveMap from '../components/map/LiveMap.vue'
import type { VehicleMapData } from '../components/map/LiveMap.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import Modal from '../components/common/Modal.vue'

const route = useRoute()
const router = useRouter()
const vehicleStore = useVehicleStore()
const driverStore = useDriverStore()
const shipmentStore = useShipmentStore()
const trackingStore = useTrackingStore()

const vehicleId = computed(() => route.params.id as string)
const editing = ref(false)
const editModalOpen = ref(false)
const editForm = ref<Partial<UpdateVehicleInput>>({})

const vehicle = computed(() => vehicleStore.currentVehicle)

const assignedDriver = computed(() =>
  driverStore.drivers.find(d => d.currentVehicleId === vehicleId.value)
)

const vehicleShipments = computed(() =>
  shipmentStore.shipments.filter(s => s.assignedVehicleId === vehicleId.value)
)

const mapVehicles = computed<VehicleMapData[]>(() => {
  const v = vehicle.value
  if (!v || v.currentLat == null || v.currentLng == null) return []
  return [{
    id: v.id,
    lat: v.currentLat,
    lng: v.currentLng,
    heading: v.currentHeading ?? 0,
    speed: v.currentSpeed ?? undefined,
    licensePlate: v.licensePlate,
    status: v.status,
    make: v.make,
    model: v.model,
    type: v.type,
  }]
})

function openEditModal() {
  const v = vehicle.value
  if (!v) return
  editForm.value = {
    licensePlate: v.licensePlate,
    status: v.status,
    capacityKg: v.capacityKg,
    fuelType: v.fuelType ?? undefined,
    odometerKm: v.odometerKm ?? undefined,
  }
  editModalOpen.value = true
}

async function saveEdit() {
  await vehicleStore.updateVehicle(vehicleId.value, editForm.value as UpdateVehicleInput)
  editModalOpen.value = false
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

onMounted(async () => {
  await vehicleStore.fetchVehicle(vehicleId.value)
  await driverStore.fetchDrivers()
  await shipmentStore.fetchShipments({ vehicleId: vehicleId.value } as any)

  trackingStore.connect()
  trackingStore.trackVehicle(vehicleId.value)
})

onUnmounted(() => {
  trackingStore.stopTracking()
})
</script>

<template>
  <AppLayout>
    <div v-if="vehicleStore.loading && !vehicle" class="flex justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="vehicle" class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-4">
          <button
            class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            @click="router.push({ name: 'VehicleList' })"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-slate-900">{{ vehicle.licensePlate }}</h1>
            <p class="text-sm text-slate-500">{{ vehicle.make }} {{ vehicle.model }} ({{ vehicle.year }})</p>
          </div>
          <StatusBadge :status="vehicle.status" variant="vehicle" />
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          @click="openEditModal"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          Edit Vehicle
        </button>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Vehicle Details Card -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold text-slate-900">Vehicle Details</h2>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">VIN</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700 font-mono">{{ vehicle.vin }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Type</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700 capitalize">{{ vehicle.type }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Capacity</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">{{ vehicle.capacityKg.toLocaleString() }} kg</dd>
            </div>
            <div v-if="vehicle.capacityM3">
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Volume</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">{{ vehicle.capacityM3 }} m³</dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Fuel Type</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">{{ vehicle.fuelType ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Odometer</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">
                {{ vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString()} km` : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Current Speed</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">
                {{ vehicle.currentSpeed != null ? `${Math.round(vehicle.currentSpeed)} km/h` : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Last Update</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">{{ formatDate(vehicle.lastLocationUpdate) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Map -->
        <div>
          <h2 class="mb-4 text-lg font-semibold text-slate-900">Current Location</h2>
          <LiveMap
            :vehicles="mapVehicles"
            height="320px"
          />
        </div>
      </div>

      <!-- Assigned Driver -->
      <div v-if="assignedDriver" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-slate-900">Assigned Driver</h2>
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
            {{ assignedDriver.firstName.charAt(0) }}{{ assignedDriver.lastName.charAt(0) }}
          </div>
          <div>
            <p class="font-medium text-slate-900">{{ assignedDriver.firstName }} {{ assignedDriver.lastName }}</p>
            <p class="text-sm text-slate-500">License: {{ assignedDriver.licenseNumber }} · {{ assignedDriver.licenseClass }}</p>
          </div>
          <StatusBadge :status="assignedDriver.status" variant="driver" class="ml-auto" />
        </div>
      </div>

      <!-- Recent Shipments -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-slate-900">Recent Shipments</h2>
        <div v-if="vehicleShipments.length === 0" class="py-8 text-center text-sm text-slate-400">
          No shipments assigned to this vehicle
        </div>
        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="shipment in vehicleShipments.slice(0, 10)"
            :key="shipment.id"
            class="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg"
            @click="router.push({ name: 'ShipmentDetail', params: { id: shipment.id } })"
          >
            <div>
              <p class="text-sm font-medium text-slate-900">{{ shipment.referenceNumber }}</p>
              <p class="text-xs text-slate-500">{{ shipment.customerName }}</p>
            </div>
            <StatusBadge :status="shipment.status" variant="shipment" />
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Modal :is-open="editModalOpen" title="Edit Vehicle" size="md" @close="editModalOpen = false">
      <form class="space-y-4" @submit.prevent="saveEdit">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">License Plate</label>
          <input
            v-model="editForm.licensePlate"
            type="text"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <select
            v-model="editForm.status"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option v-for="s in VEHICLE_STATUSES" :key="s" :value="s">
              {{ s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }}
            </option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Capacity (kg)</label>
            <input
              v-model.number="editForm.capacityKg"
              type="number"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Odometer (km)</label>
            <input
              v-model.number="editForm.odometerKm"
              type="number"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Fuel Type</label>
          <input
            v-model="editForm.fuelType"
            type="text"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </form>
      <template #footer>
        <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" @click="editModalOpen = false">
          Cancel
        </button>
        <button
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          :disabled="vehicleStore.loading"
          @click="saveEdit"
        >
          Save Changes
        </button>
      </template>
    </Modal>
  </AppLayout>
</template>
