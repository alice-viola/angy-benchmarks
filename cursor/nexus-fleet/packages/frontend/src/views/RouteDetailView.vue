<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRouteStore } from '../stores/routes'
import { useVehicleStore } from '../stores/vehicles'
import { useDriverStore } from '../stores/drivers'
import type { RouteStop } from '@nexus-fleet/shared'
import AppLayout from '../layouts/AppLayout.vue'
import LiveMap from '../components/map/LiveMap.vue'
import type { VehicleMapData, RoutePolyline } from '../components/map/LiveMap.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const routeParam = useRoute()
const router = useRouter()
const routeStore = useRouteStore()
const vehicleStore = useVehicleStore()
const driverStore = useDriverStore()

const routeId = computed(() => routeParam.params.id as string)
const currentRoute = computed(() => routeStore.currentRoute)

const vehicle = computed(() => {
  if (!currentRoute.value?.vehicleId) return null
  return vehicleStore.vehicles.find(v => v.id === currentRoute.value!.vehicleId)
})

const driver = computed(() => {
  if (!currentRoute.value?.driverId) return null
  return driverStore.drivers.find(d => d.id === currentRoute.value!.driverId)
})

const sortedStops = computed(() => {
  if (!currentRoute.value?.stops) return []
  return [...currentRoute.value.stops].sort((a, b) => a.sequence - b.sequence)
})

const mapStopMarkers = computed<VehicleMapData[]>(() =>
  sortedStops.value
    .filter(s => s.address.lat != null && s.address.lng != null)
    .map((s, i) => ({
      id: s.id,
      lat: s.address.lat!,
      lng: s.address.lng!,
      heading: 0,
      licensePlate: `#${i + 1}`,
      status: s.status === 'completed' ? 'available' : s.status === 'arrived' ? 'in_transit' : 'idle',
    }))
)

const mapRoutePolyline = computed<RoutePolyline[]>(() => {
  const pts = sortedStops.value
    .filter(s => s.address.lat != null && s.address.lng != null)
    .map(s => ({ lat: s.address.lat!, lng: s.address.lng! }))
  if (pts.length < 2) return []
  return [{ id: routeId.value, points: pts, color: '#6366f1' }]
})

async function handleCompleteStop(stop: RouteStop) {
  if (stop.status === 'completed') return
  await routeStore.completeStop(routeId.value, stop.id)
}

onMounted(async () => {
  await routeStore.fetchRoute(routeId.value)
  await Promise.all([
    vehicleStore.fetchVehicles({ limit: 100 }),
    driverStore.fetchDrivers({ limit: 100 }),
  ])
})
</script>

<template>
  <AppLayout>
    <div v-if="routeStore.loading && !currentRoute" class="flex justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="currentRoute" class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-4">
          <button
            class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            @click="router.push({ name: 'RouteList' })"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-slate-900">{{ currentRoute.name }}</h1>
            <p class="text-sm text-slate-500">{{ new Date(currentRoute.scheduledDate).toLocaleDateString() }}</p>
          </div>
          <StatusBadge :status="currentRoute.status" variant="route" />
        </div>
      </div>

      <!-- Route Info Card -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold text-slate-900">Route Info</h2>
          <dl class="space-y-3">
            <div class="flex items-center justify-between">
              <dt class="text-sm text-slate-500">Distance</dt>
              <dd class="text-sm font-medium text-slate-900">
                {{ currentRoute.totalDistanceKm != null ? `${currentRoute.totalDistanceKm.toFixed(1)} km` : '—' }}
              </dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-sm text-slate-500">Duration</dt>
              <dd class="text-sm font-medium text-slate-900">
                {{ currentRoute.totalDurationMin != null ? `${currentRoute.totalDurationMin} min` : '—' }}
              </dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-sm text-slate-500">Stops</dt>
              <dd class="text-sm font-medium text-slate-900">{{ sortedStops.length }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-sm text-slate-500">Completed</dt>
              <dd class="text-sm font-medium text-slate-900">
                {{ sortedStops.filter(s => s.status === 'completed').length }} / {{ sortedStops.length }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Vehicle Info -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold text-slate-900">Vehicle</h2>
          <div v-if="vehicle" class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl">
              {{ { van: '🚐', truck: '🚛', semi: '🚚', refrigerated: '❄️' }[vehicle.type] ?? '🚗' }}
            </div>
            <div>
              <p class="font-medium text-slate-900">{{ vehicle.licensePlate }}</p>
              <p class="text-sm text-slate-500">{{ vehicle.make }} {{ vehicle.model }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-slate-400">No vehicle assigned</p>
        </div>

        <!-- Driver Info -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold text-slate-900">Driver</h2>
          <div v-if="driver" class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
              {{ driver.firstName.charAt(0) }}{{ driver.lastName.charAt(0) }}
            </div>
            <div>
              <p class="font-medium text-slate-900">{{ driver.firstName }} {{ driver.lastName }}</p>
              <p class="text-sm text-slate-500">{{ driver.phone }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-slate-400">No driver assigned</p>
        </div>
      </div>

      <!-- Map -->
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-slate-900">Route Map</h2>
        <LiveMap
          :vehicles="mapStopMarkers"
          :routes="mapRoutePolyline"
          height="400px"
        />
      </div>

      <!-- Stop List -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-slate-900">Stops</h2>
        <div v-if="sortedStops.length === 0" class="py-8 text-center text-sm text-slate-400">
          No stops on this route
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="(stop, idx) in sortedStops"
            :key="stop.id"
            class="flex items-center gap-4 rounded-lg border border-slate-100 p-4 transition-colors hover:bg-slate-50"
          >
            <button
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-colors"
              :class="stop.status === 'completed'
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 text-slate-400 hover:border-primary-400 hover:text-primary-500'"
              @click="handleCompleteStop(stop)"
            >
              <svg v-if="stop.status === 'completed'" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span v-else class="text-xs font-bold">{{ idx + 1 }}</span>
            </button>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-slate-900">
                  {{ stop.address.street }}
                </p>
                <span
                  class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                  :class="stop.type === 'pickup' ? 'bg-blue-50 text-blue-700' : stop.type === 'delivery' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'"
                >
                  {{ stop.type }}
                </span>
              </div>
              <p class="text-xs text-slate-500">
                {{ stop.address.city }}, {{ stop.address.state }} {{ stop.address.postalCode }}
              </p>
            </div>

            <StatusBadge :status="stop.status" />
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
