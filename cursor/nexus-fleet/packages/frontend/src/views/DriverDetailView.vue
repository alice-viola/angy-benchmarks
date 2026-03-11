<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDriverStore } from '../stores/drivers'
import { useVehicleStore } from '../stores/vehicles'
import { useShipmentStore } from '../stores/shipments'
import AppLayout from '../layouts/AppLayout.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import Modal from '../components/common/Modal.vue'

const route = useRoute()
const router = useRouter()
const driverStore = useDriverStore()
const vehicleStore = useVehicleStore()
const shipmentStore = useShipmentStore()

const driverId = computed(() => route.params.id as string)
const driver = computed(() => driverStore.currentDriver)

const vehicleModalOpen = ref(false)
const selectedVehicleId = ref<string | null>(null)

const MAX_DAILY_HOURS = 11

const currentVehicle = computed(() => {
  if (!driver.value?.currentVehicleId) return null
  return vehicleStore.vehicles.find(v => v.id === driver.value!.currentVehicleId)
})

const driverShipments = computed(() =>
  shipmentStore.shipments.filter(s => s.assignedDriverId === driverId.value)
)

const hoursEstimate = computed(() => {
  if (!driver.value) return 0
  if (driver.value.status === 'driving') return 6
  if (driver.value.status === 'on_break') return 4
  return 0
})

const hoursPct = computed(() => Math.min(100, (hoursEstimate.value / MAX_DAILY_HOURS) * 100))

const availableVehicles = computed(() =>
  vehicleStore.vehicles.filter(v => v.status === 'available')
)

function openAssignModal() {
  selectedVehicleId.value = null
  vehicleModalOpen.value = true
}

async function assignVehicle() {
  if (!selectedVehicleId.value) return
  await driverStore.assignVehicle(driverId.value, selectedVehicleId.value)
  vehicleModalOpen.value = false
}

async function unassignVehicle() {
  await driverStore.unassignVehicle(driverId.value)
}

onMounted(async () => {
  await driverStore.fetchDriver(driverId.value)
  await vehicleStore.fetchVehicles({ limit: 100 })
  await shipmentStore.fetchShipments({ driverId: driverId.value } as any)
})
</script>

<template>
  <AppLayout>
    <div v-if="driverStore.loading && !driver" class="flex justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="driver" class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-4">
          <button
            class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            @click="router.push({ name: 'DriverList' })"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
            {{ driver.firstName.charAt(0) }}{{ driver.lastName.charAt(0) }}
          </div>
          <div>
            <h1 class="text-2xl font-bold text-slate-900">{{ driver.firstName }} {{ driver.lastName }}</h1>
            <p class="text-sm text-slate-500">{{ driver.email }}</p>
          </div>
          <StatusBadge :status="driver.status" variant="driver" />
        </div>
        <div class="flex gap-2">
          <button
            v-if="driver.currentVehicleId"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            @click="unassignVehicle"
          >
            Unassign Vehicle
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
            @click="openAssignModal"
          >
            {{ driver.currentVehicleId ? 'Reassign Vehicle' : 'Assign Vehicle' }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Driver Details -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold text-slate-900">Driver Details</h2>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Phone</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">{{ driver.phone }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">License Number</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700 font-mono">{{ driver.licenseNumber }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">License Class</dt>
              <dd class="mt-1 flex gap-1">
                <span
                  v-for="cls in driver.licenseClass.split(',')"
                  :key="cls"
                  class="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700"
                >
                  {{ cls.trim() }}
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">License Expiry</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">
                {{ new Date(driver.licenseExpiry).toLocaleDateString() }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Created</dt>
              <dd class="mt-1 text-sm font-medium text-slate-700">
                {{ new Date(driver.createdAt).toLocaleDateString() }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Driving Hours -->
        <div class="space-y-6">
          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="mb-4 text-lg font-semibold text-slate-900">Driving Hours</h2>
            <div class="flex items-end justify-between">
              <div>
                <p class="text-3xl font-bold text-slate-900">{{ hoursEstimate }}h</p>
                <p class="text-sm text-slate-500">of {{ MAX_DAILY_HOURS }}h daily limit</p>
              </div>
              <span
                :class="[
                  'rounded-full px-3 py-1 text-xs font-medium',
                  hoursPct > 80 ? 'bg-red-50 text-red-700' : hoursPct > 50 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
                ]"
              >
                {{ Math.round(hoursPct) }}% used
              </span>
            </div>
            <div class="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="hoursPct > 80 ? 'bg-red-500' : hoursPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'"
                :style="{ width: `${hoursPct}%` }"
              />
            </div>
          </div>

          <!-- Current Vehicle -->
          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="mb-4 text-lg font-semibold text-slate-900">Current Vehicle</h2>
            <div v-if="currentVehicle" class="flex items-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl">
                {{ { van: '🚐', truck: '🚛', semi: '🚚', refrigerated: '❄️' }[currentVehicle.type] ?? '🚗' }}
              </div>
              <div>
                <p class="font-medium text-slate-900">{{ currentVehicle.licensePlate }}</p>
                <p class="text-sm text-slate-500">{{ currentVehicle.make }} {{ currentVehicle.model }}</p>
              </div>
              <StatusBadge :status="currentVehicle.status" variant="vehicle" class="ml-auto" />
            </div>
            <p v-else class="text-sm text-slate-400">No vehicle assigned</p>
          </div>
        </div>
      </div>

      <!-- Recent Shipments -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-slate-900">Recent Shipments</h2>
        <div v-if="driverShipments.length === 0" class="py-8 text-center text-sm text-slate-400">
          No shipments assigned to this driver
        </div>
        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="shipment in driverShipments.slice(0, 10)"
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

    <!-- Assign Vehicle Modal -->
    <Modal :is-open="vehicleModalOpen" title="Assign Vehicle" size="md" @close="vehicleModalOpen = false">
      <div class="space-y-4">
        <p class="text-sm text-slate-600">Select a vehicle to assign to this driver.</p>
        <select
          v-model="selectedVehicleId"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option :value="null" disabled>Choose a vehicle...</option>
          <option v-for="v in availableVehicles" :key="v.id" :value="v.id">
            {{ v.licensePlate }} — {{ v.make }} {{ v.model }} ({{ v.capacityKg }} kg)
          </option>
        </select>
        <p v-if="availableVehicles.length === 0" class="text-sm text-amber-600">
          No available vehicles at the moment.
        </p>
      </div>
      <template #footer>
        <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" @click="vehicleModalOpen = false">
          Cancel
        </button>
        <button
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="!selectedVehicleId || driverStore.loading"
          @click="assignVehicle"
        >
          Assign Vehicle
        </button>
      </template>
    </Modal>
  </AppLayout>
</template>
