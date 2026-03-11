<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import StatsCard from '@/components/analytics/StatsCard.vue'
import LiveMap from '@/components/map/LiveMap.vue'
import DoughnutChart from '@/components/analytics/DoughnutChart.vue'
import LineChart from '@/components/analytics/LineChart.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useTrackingStore } from '@/stores/tracking'
import { useVehicleStore } from '@/stores/vehicles'
import { useDriverStore } from '@/stores/drivers'
import { useShipmentStore } from '@/stores/shipments'
import { useGeofenceStore } from '@/stores/geofences'
import { useApi } from '@/composables/useApi'
import type { VehicleMapData } from '@/components/map/LiveMap.vue'

const api = useApi()
const trackingStore = useTrackingStore()
const vehicleStore = useVehicleStore()
const driverStore = useDriverStore()
const shipmentStore = useShipmentStore()
const geofenceStore = useGeofenceStore()

const loading = ref(true)
const stats = ref({
  totalVehicles: 0,
  activeDrivers: 0,
  activeShipments: 0,
  deliveredToday: 0,
  vehicleTrend: null as { value: number; direction: 'up' | 'down' } | null,
  driverTrend: null as { value: number; direction: 'up' | 'down' } | null,
  shipmentTrend: null as { value: number; direction: 'up' | 'down' } | null,
  deliveryTrend: null as { value: number; direction: 'up' | 'down' } | null,
})

const shipmentsByStatus = ref<Record<string, number>>({})
const deliveriesOverTime = ref<{ labels: string[]; datasets: { label: string; data: number[]; borderColor: string }[] }>({
  labels: [],
  datasets: [],
})

interface GeofenceAlert {
  id: string
  vehiclePlate: string
  geofenceName: string
  eventType: 'enter' | 'exit'
  timestamp: string
}

const recentAlerts = ref<GeofenceAlert[]>([])

const vehicleMapData = computed<VehicleMapData[]>(() => {
  const positions = trackingStore.vehiclePositions
  const result: VehicleMapData[] = []
  for (const [vehicleId, pos] of positions) {
    const vehicle = vehicleStore.vehicles.find((v) => v.id === vehicleId)
    result.push({
      id: vehicleId,
      lat: pos.lat,
      lng: pos.lng,
      heading: pos.heading,
      speed: pos.speed_kmh,
      licensePlate: vehicle?.licensePlate ?? vehicleId.slice(0, 8),
      status: vehicle?.status ?? 'available',
      make: vehicle?.make,
      model: vehicle?.model,
      type: vehicle?.type,
    })
  }
  return result
})

async function loadDashboard() {
  loading.value = true
  try {
    const [analyticsRes] = await Promise.all([
      api.get('/analytics/overview').catch(() => null),
      vehicleStore.fetchVehicles({ limit: 200 }),
      driverStore.fetchDrivers({ limit: 200 }),
      shipmentStore.fetchShipments({ limit: 1 }),
      geofenceStore.fetchGeofences(),
    ])

    if (analyticsRes?.data?.data) {
      const d = analyticsRes.data.data
      stats.value.totalVehicles = d.totalVehicles ?? vehicleStore.vehicles.length
      stats.value.activeDrivers = d.activeDrivers ?? driverStore.drivers.filter((dr) => dr.status === 'driving' || dr.status === 'available').length
      stats.value.activeShipments = d.activeShipments ?? 0
      stats.value.deliveredToday = d.deliveredToday ?? 0
      stats.value.vehicleTrend = d.vehicleTrend ?? null
      stats.value.driverTrend = d.driverTrend ?? null
      stats.value.shipmentTrend = d.shipmentTrend ?? null
      stats.value.deliveryTrend = d.deliveryTrend ?? null

      if (d.shipmentsByStatus) {
        shipmentsByStatus.value = d.shipmentsByStatus
      }

      if (d.deliveriesOverTime) {
        deliveriesOverTime.value = {
          labels: d.deliveriesOverTime.labels ?? [],
          datasets: d.deliveriesOverTime.datasets ?? [
            { label: 'Deliveries', data: d.deliveriesOverTime.data ?? [], borderColor: '#6366f1' },
          ],
        }
      }

      if (d.recentAlerts) {
        recentAlerts.value = d.recentAlerts
      }
    } else {
      stats.value.totalVehicles = vehicleStore.vehicles.length
      stats.value.activeDrivers = driverStore.drivers.filter((dr) => dr.status === 'driving' || dr.status === 'available').length
      stats.value.activeShipments = shipmentStore.pagination.total
      shipmentsByStatus.value = buildShipmentStatusCounts()
    }
  } catch {
    stats.value.totalVehicles = vehicleStore.vehicles.length
    stats.value.activeDrivers = driverStore.drivers.length
  } finally {
    loading.value = false
  }
}

function buildShipmentStatusCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const s of shipmentStore.shipments) {
    counts[s.status] = (counts[s.status] ?? 0) + 1
  }
  return counts
}

function formatAlertTime(timestamp: string): string {
  const d = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

onMounted(() => {
  loadDashboard()
  trackingStore.connect()
  trackingStore.subscribe(['tracking'])
})

onUnmounted(() => {
  trackingStore.disconnect()
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Page header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="mt-1 text-sm text-gray-500">Real-time overview of your fleet operations</p>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>

      <template v-else>
        <!-- Stats cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Total Vehicles"
            :value="stats.totalVehicles"
            icon="🚛"
            color="blue"
            :trend="stats.vehicleTrend ?? undefined"
          />
          <StatsCard
            title="Active Drivers"
            :value="stats.activeDrivers"
            icon="👤"
            color="green"
            :trend="stats.driverTrend ?? undefined"
          />
          <StatsCard
            title="Active Shipments"
            :value="stats.activeShipments"
            icon="📦"
            color="amber"
            :trend="stats.shipmentTrend ?? undefined"
          />
          <StatsCard
            title="Delivered Today"
            :value="stats.deliveredToday"
            icon="✅"
            color="green"
            :trend="stats.deliveryTrend ?? undefined"
          />
        </div>

        <!-- Live map -->
        <div>
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Live Fleet Map</h2>
            <div class="flex items-center gap-2 text-sm text-gray-500">
              <span
                :class="[
                  'h-2 w-2 rounded-full',
                  trackingStore.connectionStatus === 'connected' ? 'bg-emerald-500' : trackingStore.connectionStatus === 'reconnecting' ? 'bg-amber-500' : 'bg-red-500',
                ]"
              />
              {{ vehicleMapData.length }} vehicles tracked
            </div>
          </div>
          <LiveMap
            :vehicles="vehicleMapData"
            height="450px"
          />
        </div>

        <!-- Charts row -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DoughnutChart
            title="Shipments by Status"
            :data="shipmentsByStatus"
          />
          <LineChart
            title="Deliveries (Last 30 Days)"
            :data="deliveriesOverTime"
          />
        </div>

        <!-- Recent alerts feed -->
        <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 class="text-sm font-semibold text-gray-700">Recent Geofence Alerts</h2>
            <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {{ recentAlerts.length }} events
            </span>
          </div>
          <div v-if="recentAlerts.length === 0" class="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <svg class="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <p class="text-sm text-gray-500">No recent geofence alerts</p>
          </div>
          <ul v-else class="max-h-72 divide-y divide-gray-100 overflow-y-auto">
            <li
              v-for="alert in recentAlerts"
              :key="alert.id"
              class="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-50"
            >
              <div
                :class="[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  alert.eventType === 'enter' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
                ]"
              >
                <svg v-if="alert.eventType === 'enter'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900">
                  <span class="font-semibold">{{ alert.vehiclePlate }}</span>
                  <StatusBadge :status="alert.eventType === 'enter' ? 'confirmed' : 'pending'" class="ml-2" />
                </p>
                <p class="text-xs text-gray-500">
                  {{ alert.eventType === 'enter' ? 'Entered' : 'Exited' }}
                  <span class="font-medium">{{ alert.geofenceName }}</span>
                </p>
              </div>
              <span class="shrink-0 text-xs text-gray-400">
                {{ formatAlertTime(alert.timestamp) }}
              </span>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
