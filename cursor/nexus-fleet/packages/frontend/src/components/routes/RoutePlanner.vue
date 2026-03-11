<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import { haversineDistance } from '@nexus-fleet/shared'
import type { Vehicle, Driver, Shipment, Route as FleetRoute, RouteStop } from '@nexus-fleet/shared'
import LiveMap from '../map/LiveMap.vue'
import type { VehicleMapData, RoutePolyline } from '../map/LiveMap.vue'

interface StopItem {
  id: string
  shipmentId: string
  label: string
  address: string
  lat: number
  lng: number
  weightKg: number
  type: 'pickup' | 'delivery'
}

const props = withDefaults(
  defineProps<{
    route?: FleetRoute | null
    unassignedShipments: Shipment[]
    vehicles: Vehicle[]
    drivers: Driver[]
  }>(),
  { route: null },
)

const emit = defineEmits<{
  save: [routeData: Record<string, unknown>]
  optimize: [routeId: string]
}>()

const selectedVehicleId = ref<string | null>(props.route?.vehicleId ?? null)
const selectedDriverId = ref<string | null>(props.route?.driverId ?? null)
const stops = ref<StopItem[]>([])
const filterQuery = ref('')

if (props.route?.stops?.length) {
  stops.value = props.route.stops.map((s: RouteStop) => ({
    id: s.id,
    shipmentId: s.shipmentId ?? '',
    label: `Stop #${s.sequence + 1}`,
    address: s.address.street,
    lat: s.address.lat ?? 0,
    lng: s.address.lng ?? 0,
    weightKg: 0,
    type: s.type === 'delivery' ? 'delivery' : 'pickup',
  }))
}

function shipmentToStop(s: Shipment): StopItem {
  return {
    id: `stop-${s.id}`,
    shipmentId: s.id,
    label: `${s.referenceNumber} — ${s.customerName}`,
    address: s.pickupAddress.street,
    lat: s.pickupAddress.lat ?? 0,
    lng: s.pickupAddress.lng ?? 0,
    weightKg: s.weightKg,
    type: 'pickup',
  }
}

const assignedShipmentIds = computed(() => new Set(stops.value.map((s) => s.shipmentId)))

const filteredUnassigned = computed(() => {
  let list = props.unassignedShipments.filter((s) => !assignedShipmentIds.value.has(s.id))
  if (filterQuery.value) {
    const q = filterQuery.value.toLowerCase()
    list = list.filter(
      (s) =>
        s.referenceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.pickupAddress.street.toLowerCase().includes(q),
    )
  }
  return list
})

const unassignedDragItems = computed(() =>
  filteredUnassigned.value.map(shipmentToStop),
)

const selectedVehicle = computed(() =>
  props.vehicles.find((v) => v.id === selectedVehicleId.value),
)

const totalWeight = computed(() => stops.value.reduce((sum, s) => sum + s.weightKg, 0))

const capacityPct = computed(() => {
  if (!selectedVehicle.value) return 0
  return Math.min(100, (totalWeight.value / selectedVehicle.value.capacityKg) * 100)
})

const overCapacity = computed(
  () => selectedVehicle.value != null && totalWeight.value > selectedVehicle.value.capacityKg,
)

const totalDistanceKm = computed(() => {
  if (stops.value.length < 2) return 0
  let dist = 0
  for (let i = 1; i < stops.value.length; i++) {
    dist += haversineDistance(
      stops.value[i - 1].lat,
      stops.value[i - 1].lng,
      stops.value[i].lat,
      stops.value[i].lng,
    )
  }
  return dist
})

const mapVehicles = computed<VehicleMapData[]>(() =>
  stops.value
    .filter((s) => s.lat !== 0 || s.lng !== 0)
    .map((s, i) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      heading: 0,
      licensePlate: `#${i + 1}`,
      status: 'available',
      type: 'marker',
    })),
)

const mapRoute = computed<RoutePolyline[]>(() => {
  if (stops.value.length < 2) return []
  return [
    {
      id: 'planner-route',
      points: stops.value.map((s) => ({ lat: s.lat, lng: s.lng })),
      color: '#6366f1',
    },
  ]
})

function removeStop(idx: number) {
  stops.value.splice(idx, 1)
}

function handleSave() {
  emit('save', {
    vehicleId: selectedVehicleId.value,
    driverId: selectedDriverId.value,
    stops: stops.value.map((s, i) => ({
      shipmentId: s.shipmentId,
      type: s.type,
      sequence: i,
      address: { street: s.address, lat: s.lat, lng: s.lng },
    })),
  })
}

function handleOptimize() {
  if (props.route?.id) {
    emit('optimize', props.route.id)
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 lg:flex-row">
    <!-- Left Panel -->
    <div class="flex w-full flex-col gap-4 overflow-hidden lg:w-1/2">
      <!-- Vehicle & Driver Selection -->
      <div class="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-500">Vehicle</label>
          <select
            v-model="selectedVehicleId"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option :value="null">Select vehicle...</option>
            <option v-for="v in vehicles" :key="v.id" :value="v.id">
              {{ v.licensePlate }} — {{ v.make }} {{ v.model }} ({{ v.capacityKg }} kg)
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-500">Driver</label>
          <select
            v-model="selectedDriverId"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option :value="null">Select driver...</option>
            <option v-for="d in drivers" :key="d.id" :value="d.id">
              {{ d.firstName }} {{ d.lastName }} ({{ d.licenseClass }})
            </option>
          </select>
        </div>
      </div>

      <!-- Unassigned Shipments -->
      <div class="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="border-b border-gray-100 px-4 py-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700">
              Unassigned Shipments
              <span class="ml-1 text-xs font-normal text-gray-400">({{ filteredUnassigned.length }})</span>
            </h3>
          </div>
          <input
            v-model="filterQuery"
            type="text"
            placeholder="Filter shipments..."
            class="mt-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div class="max-h-40 overflow-y-auto p-2">
          <draggable
            :list="unassignedDragItems"
            :group="{ name: 'stops', pull: 'clone', put: false }"
            item-key="id"
            :sort="false"
            :clone="(item: StopItem) => ({ ...item, id: `stop-${Date.now()}-${Math.random().toString(36).slice(2)}` })"
            class="space-y-1"
          >
            <template #item="{ element }">
              <div class="cursor-grab rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm transition hover:border-indigo-200 hover:bg-indigo-50">
                <div class="font-medium text-gray-800">{{ element.label }}</div>
                <div class="text-xs text-gray-400">{{ element.address }} · {{ element.weightKg }} kg</div>
              </div>
            </template>
          </draggable>
          <p
            v-if="filteredUnassigned.length === 0"
            class="py-4 text-center text-xs text-gray-400"
          >
            No unassigned shipments
          </p>
        </div>
      </div>

      <!-- Route Stops -->
      <div class="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 class="text-sm font-semibold text-gray-700">
            Route Stops
            <span class="ml-1 text-xs font-normal text-gray-400">({{ stops.length }})</span>
          </h3>
          <span class="text-xs text-gray-400">
            {{ totalDistanceKm.toFixed(1) }} km estimated
          </span>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <draggable
            v-model="stops"
            :group="{ name: 'stops', pull: false, put: true }"
            item-key="id"
            handle=".drag-handle"
            animation="200"
            class="min-h-[60px] space-y-1"
          >
            <template #item="{ element, index }">
              <div class="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm">
                <span class="drag-handle cursor-grab text-gray-300 hover:text-gray-500">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                  </svg>
                </span>
                <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {{ index + 1 }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-gray-800">{{ element.label }}</div>
                  <div class="truncate text-xs text-gray-400">{{ element.address }}</div>
                </div>
                <span class="flex-shrink-0 text-xs text-gray-400">{{ element.weightKg }} kg</span>
                <button
                  class="flex-shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                  @click="removeStop(index)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </template>
          </draggable>
          <p v-if="stops.length === 0" class="py-6 text-center text-xs text-gray-400">
            Drag shipments here to build your route
          </p>
        </div>

        <!-- Capacity bar -->
        <div class="border-t border-gray-100 px-4 py-3">
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500">
              Cargo: {{ totalWeight.toLocaleString() }} kg
              <template v-if="selectedVehicle">
                / {{ selectedVehicle.capacityKg.toLocaleString() }} kg
              </template>
            </span>
            <span v-if="overCapacity" class="font-semibold text-red-600">Over capacity!</span>
          </div>
          <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              class="h-full rounded-full transition-all"
              :class="overCapacity ? 'bg-red-500' : 'bg-indigo-500'"
              :style="{ width: `${capacityPct}%` }"
            />
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
          <button
            v-if="route?.id"
            class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
            @click="handleOptimize"
          >
            Optimize Route
          </button>
          <div class="flex-1" />
          <button
            class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            :disabled="stops.length === 0"
            @click="handleSave"
          >
            Save Route
          </button>
        </div>
      </div>
    </div>

    <!-- Right Panel: Map Preview -->
    <div class="w-full lg:w-1/2">
      <div class="sticky top-4">
        <LiveMap
          :vehicles="mapVehicles"
          :routes="mapRoute"
          height="600px"
        />
        <div class="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-600">
          <span>{{ stops.length }} stops</span>
          <span class="font-medium">{{ totalDistanceKm.toFixed(1) }} km total</span>
        </div>
      </div>
    </div>
  </div>
</template>
