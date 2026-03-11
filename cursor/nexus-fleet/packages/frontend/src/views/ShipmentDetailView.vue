<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ShipmentTimeline from '@/components/shipments/ShipmentTimeline.vue'
import Modal from '@/components/common/Modal.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import LiveMap from '@/components/map/LiveMap.vue'
import { useShipmentStore } from '@/stores/shipments'
import { useVehicleStore } from '@/stores/vehicles'
import { useDriverStore } from '@/stores/drivers'
import type { Shipment, ShipmentTransitionAction } from '@nexus-fleet/shared'

const route = useRoute()
const router = useRouter()
const shipmentStore = useShipmentStore()
const vehicleStore = useVehicleStore()
const driverStore = useDriverStore()

const shipmentId = computed(() => route.params.id as string)
const shipment = computed(() => shipmentStore.currentShipment)
const loading = ref(true)
const events = ref<any[]>([])
const transitioning = ref(false)

const activeModal = ref<ShipmentTransitionAction | null>(null)
const modalVehicleId = ref('')
const modalDriverId = ref('')
const modalNotes = ref('')
const modalPodFile = ref<File | null>(null)

interface TransitionOption {
  action: ShipmentTransitionAction
  label: string
  icon: string
  color: string
  bgColor: string
}

const STATUS_TRANSITIONS: Record<string, TransitionOption[]> = {
  draft: [
    { action: 'confirm', label: 'Confirm', icon: '✓', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
    { action: 'cancel', label: 'Cancel', icon: '✕', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200 hover:bg-red-100' },
  ],
  confirmed: [
    { action: 'assign', label: 'Assign', icon: '→', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
    { action: 'cancel', label: 'Cancel', icon: '✕', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200 hover:bg-red-100' },
  ],
  assigned: [
    { action: 'pickup', label: 'Pick Up', icon: '📦', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200 hover:bg-amber-100' },
    { action: 'cancel', label: 'Cancel', icon: '✕', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200 hover:bg-red-100' },
  ],
  picked_up: [
    { action: 'depart', label: 'Depart', icon: '🚛', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
  ],
  in_transit: [
    { action: 'deliver', label: 'Deliver', icon: '✅', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
    { action: 'fail', label: 'Mark Failed', icon: '!', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200 hover:bg-red-100' },
  ],
}

const availableTransitions = computed<TransitionOption[]>(() => {
  if (!shipment.value) return []
  return STATUS_TRANSITIONS[shipment.value.status] ?? []
})

const hasMapData = computed(() => {
  if (!shipment.value) return false
  return (
    (shipment.value.pickupAddress?.lat && shipment.value.pickupAddress?.lng) ||
    (shipment.value.deliveryAddress?.lat && shipment.value.deliveryAddress?.lng)
  )
})

const mapMarkers = computed(() => {
  if (!shipment.value) return []
  const markers = []
  if (shipment.value.pickupAddress?.lat && shipment.value.pickupAddress?.lng) {
    markers.push({
      id: 'origin',
      lat: shipment.value.pickupAddress.lat,
      lng: shipment.value.pickupAddress.lng,
      heading: 0,
      licensePlate: 'Origin',
      status: 'available',
    })
  }
  if (shipment.value.deliveryAddress?.lat && shipment.value.deliveryAddress?.lng) {
    markers.push({
      id: 'destination',
      lat: shipment.value.deliveryAddress.lat,
      lng: shipment.value.deliveryAddress.lng,
      heading: 0,
      licensePlate: 'Destination',
      status: 'delivered',
    })
  }
  return markers
})

function openTransitionModal(action: ShipmentTransitionAction) {
  activeModal.value = action
  modalVehicleId.value = ''
  modalDriverId.value = ''
  modalNotes.value = ''
  modalPodFile.value = null

  if (action === 'assign') {
    vehicleStore.fetchVehicles({ limit: 100 })
    driverStore.fetchDrivers({ limit: 100 })
  }
}

function closeModal() {
  activeModal.value = null
}

async function executeTransition() {
  if (!shipment.value || !activeModal.value) return
  transitioning.value = true
  try {
    await shipmentStore.transitionShipment(shipment.value.id, activeModal.value, {
      vehicleId: modalVehicleId.value || undefined,
      driverId: modalDriverId.value || undefined,
      notes: modalNotes.value || undefined,
    })
    closeModal()
    await loadEvents()
  } finally {
    transitioning.value = false
  }
}

async function loadEvents() {
  try {
    events.value = await shipmentStore.fetchEvents(shipmentId.value)
  } catch {
    events.value = []
  }
}

async function loadShipment() {
  loading.value = true
  try {
    await shipmentStore.fetchShipment(shipmentId.value)
    await loadEvents()
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatWeight(kg: number | null | undefined): string {
  if (kg == null) return '—'
  return `${kg.toLocaleString()} kg`
}

function getModalTitle(): string {
  const titles: Record<string, string> = {
    confirm: 'Confirm Shipment',
    assign: 'Assign Vehicle & Driver',
    pickup: 'Mark as Picked Up',
    depart: 'Mark as Departed',
    deliver: 'Mark as Delivered',
    fail: 'Mark as Failed',
    cancel: 'Cancel Shipment',
  }
  return titles[activeModal.value ?? ''] ?? 'Transition Shipment'
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
      <p class="mt-1 text-sm text-gray-500">The shipment you're looking for doesn't exist or has been removed.</p>
      <RouterLink to="/shipments" class="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700">
        Back to shipments
      </RouterLink>
    </div>

    <!-- Detail content -->
    <div v-else class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex items-start gap-4">
          <button
            class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 transition-colors"
            @click="router.push('/shipments')"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-gray-900">{{ shipment.referenceCode }}</h1>
              <StatusBadge :status="shipment.status" variant="shipment" />
            </div>
            <p class="mt-1 text-sm text-gray-500">
              {{ shipment.customerName }} &middot; Created {{ formatDate(shipment.createdAt) }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Edit button -->
          <RouterLink
            v-if="shipment.status === 'draft' || shipment.status === 'confirmed'"
            :to="{ name: 'ShipmentEdit', params: { id: shipment.id } }"
            class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Edit
          </RouterLink>

          <!-- Transition buttons -->
          <button
            v-for="t in availableTransitions"
            :key="t.action"
            :class="['inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-colors', t.bgColor, t.color]"
            @click="openTransitionModal(t.action)"
          >
            <span class="text-base leading-none">{{ t.icon }}</span>
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Left column: Details -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Shipment details card -->
          <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div class="border-b border-gray-200 px-6 py-4">
              <h2 class="text-sm font-semibold text-gray-700">Shipment Details</h2>
            </div>
            <div class="grid grid-cols-1 gap-px bg-gray-100 sm:grid-cols-2">
              <div class="bg-white px-6 py-4">
                <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Reference Code</dt>
                <dd class="mt-1 text-sm font-semibold text-gray-900">{{ shipment.referenceCode }}</dd>
              </div>
              <div class="bg-white px-6 py-4">
                <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Customer</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ shipment.customerName }}</dd>
              </div>
              <div class="bg-white px-6 py-4">
                <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Priority</dt>
                <dd class="mt-1">
                  <span
                    :class="[
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      shipment.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      shipment.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                      shipment.priority === 'normal' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600',
                    ]"
                  >
                    {{ shipment.priority }}
                  </span>
                </dd>
              </div>
              <div class="bg-white px-6 py-4">
                <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Cargo Type</dt>
                <dd class="mt-1 text-sm text-gray-900 capitalize">{{ shipment.cargoType }}</dd>
              </div>
              <div class="bg-white px-6 py-4">
                <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Weight</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatWeight(shipment.weightKg) }}</dd>
              </div>
              <div class="bg-white px-6 py-4">
                <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Volume</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ shipment.volumeM3 ? `${shipment.volumeM3} m³` : '—' }}</dd>
              </div>
              <div class="bg-white px-6 py-4">
                <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Scheduled Pickup</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatDate(shipment.scheduledPickup) }}</dd>
              </div>
              <div class="bg-white px-6 py-4">
                <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Actual Delivery</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatDate(shipment.actualDelivery) }}</dd>
              </div>
            </div>

            <!-- Cargo description -->
            <div v-if="shipment.cargoDescription" class="border-t border-gray-100 px-6 py-4">
              <dt class="text-xs font-medium uppercase tracking-wider text-gray-400">Cargo Description</dt>
              <dd class="mt-1 text-sm text-gray-700">{{ shipment.cargoDescription }}</dd>
            </div>
          </div>

          <!-- Origin & Destination -->
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div class="mb-3 flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Origin</h3>
              </div>
              <p class="text-sm text-gray-900">{{ shipment.pickupAddress?.street ?? '—' }}</p>
              <p v-if="shipment.pickupAddress?.city" class="mt-0.5 text-xs text-gray-500">
                {{ shipment.pickupAddress.city }}{{ shipment.pickupAddress.state ? `, ${shipment.pickupAddress.state}` : '' }}
              </p>
            </div>
            <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div class="mb-3 flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                  </svg>
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Destination</h3>
              </div>
              <p class="text-sm text-gray-900">{{ shipment.deliveryAddress?.street ?? '—' }}</p>
              <p v-if="shipment.deliveryAddress?.city" class="mt-0.5 text-xs text-gray-500">
                {{ shipment.deliveryAddress.city }}{{ shipment.deliveryAddress.state ? `, ${shipment.deliveryAddress.state}` : '' }}
              </p>
            </div>
          </div>

          <!-- Map -->
          <div v-if="hasMapData">
            <LiveMap
              :vehicles="mapMarkers"
              height="300px"
            />
          </div>
        </div>

        <!-- Right column: Timeline -->
        <div class="space-y-6">
          <!-- Vehicle & Driver info -->
          <div
            v-if="shipment.vehicleId || shipment.driverId"
            class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h3 class="mb-3 text-sm font-semibold text-gray-700">Assignment</h3>
            <div class="space-y-3">
              <div v-if="shipment.vehicleId" class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">Vehicle</p>
                  <p class="text-xs text-gray-500">{{ shipment.vehicleId }}</p>
                </div>
              </div>
              <div v-if="shipment.driverId" class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">Driver</p>
                  <p class="text-xs text-gray-500">{{ shipment.driverId }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline -->
          <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold text-gray-700">Shipment Timeline</h3>
            <ShipmentTimeline :events="events" />
          </div>
        </div>
      </div>
    </div>

    <!-- Transition Modals -->
    <Modal
      :is-open="activeModal !== null"
      :title="getModalTitle()"
      :size="activeModal === 'assign' ? 'lg' : 'md'"
      @close="closeModal"
    >
      <div class="space-y-4">
        <!-- Assign modal: Vehicle & Driver selection -->
        <template v-if="activeModal === 'assign'">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700">Vehicle</label>
            <select
              v-model="modalVehicleId"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Select a vehicle…</option>
              <option
                v-for="v in vehicleStore.vehicles.filter(vh => vh.status === 'available')"
                :key="v.id"
                :value="v.id"
              >
                {{ v.licensePlate }} — {{ v.make }} {{ v.model }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700">Driver</label>
            <select
              v-model="modalDriverId"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Select a driver…</option>
              <option
                v-for="d in driverStore.drivers.filter(dr => dr.status === 'available')"
                :key="d.id"
                :value="d.id"
              >
                {{ d.firstName }} {{ d.lastName }} — {{ d.licenseNumber }}
              </option>
            </select>
          </div>
        </template>

        <!-- Deliver modal: POD upload -->
        <template v-if="activeModal === 'deliver'">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700">Proof of Delivery (optional)</label>
            <div class="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-8 transition-colors hover:border-gray-400">
              <div class="text-center">
                <svg class="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <label class="mt-2 block cursor-pointer text-sm font-medium text-primary-600 hover:text-primary-500">
                  Upload a file
                  <input type="file" class="sr-only" accept="image/*,.pdf" @change="modalPodFile = ($event.target as HTMLInputElement).files?.[0] ?? null" />
                </label>
                <p class="mt-1 text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
                <p v-if="modalPodFile" class="mt-2 text-sm font-medium text-gray-700">{{ modalPodFile.name }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- Cancel / Fail modal: Reason input -->
        <template v-if="activeModal === 'cancel' || activeModal === 'fail'">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700">
              {{ activeModal === 'cancel' ? 'Cancellation reason' : 'Failure reason' }}
            </label>
            <textarea
              v-model="modalNotes"
              rows="3"
              :placeholder="activeModal === 'cancel' ? 'Why is this shipment being cancelled?' : 'What went wrong?'"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </template>

        <!-- Notes (for all modals) -->
        <div v-if="activeModal !== 'cancel' && activeModal !== 'fail'">
          <label class="mb-1.5 block text-sm font-medium text-gray-700">Notes (optional)</label>
          <textarea
            v-model="modalNotes"
            rows="2"
            placeholder="Add any additional notes…"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <template #footer>
        <button
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          @click="closeModal"
        >
          Cancel
        </button>
        <button
          :disabled="transitioning || (activeModal === 'assign' && !modalVehicleId)"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="executeTransition"
        >
          <svg
            v-if="transitioning"
            class="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ transitioning ? 'Processing…' : getModalTitle() }}
        </button>
      </template>
    </Modal>
  </AppLayout>
</template>
