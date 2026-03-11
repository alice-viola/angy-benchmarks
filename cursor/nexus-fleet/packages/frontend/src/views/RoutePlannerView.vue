<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRouteStore } from '../stores/routes'
import { useVehicleStore } from '../stores/vehicles'
import { useDriverStore } from '../stores/drivers'
import { useShipmentStore } from '../stores/shipments'
import { useToast } from '../composables/useToast'
import AppLayout from '../layouts/AppLayout.vue'
import RoutePlanner from '../components/routes/RoutePlanner.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const router = useRouter()
const routeStore = useRouteStore()
const vehicleStore = useVehicleStore()
const driverStore = useDriverStore()
const shipmentStore = useShipmentStore()
const toast = useToast()

const loading = ref(true)
const optimizing = ref(false)

async function handleSave(routeData: Record<string, unknown>) {
  try {
    const created = await routeStore.createRoute({
      name: `Route ${new Date().toLocaleDateString()}`,
      scheduledDate: new Date().toISOString().split('T')[0],
      vehicleId: routeData.vehicleId as string | undefined,
      driverId: routeData.driverId as string | undefined,
      stops: routeData.stops as any[],
    })
    router.push({ name: 'RouteDetail', params: { id: created.id } })
  } catch {
    toast.error('Failed to create route')
  }
}

async function handleOptimize(routeId: string) {
  optimizing.value = true
  try {
    const jobId = await routeStore.optimizeRoute(routeId)
    await routeStore.pollOptimization(routeId, jobId)
    toast.success('Route optimized successfully')
  } catch {
    toast.error('Optimization failed')
  } finally {
    optimizing.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      vehicleStore.fetchVehicles({ limit: 100 }),
      driverStore.fetchDrivers({ limit: 100 }),
      shipmentStore.fetchShipments({ status: 'confirmed', limit: 100 }),
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
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
          <h1 class="text-2xl font-bold text-slate-900">Plan New Route</h1>
          <p class="text-sm text-slate-500">Drag shipments to build and optimize your route</p>
        </div>
      </div>

      <!-- Optimization Banner -->
      <div
        v-if="optimizing"
        class="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
      >
        <LoadingSpinner size="sm" />
        <div>
          <p class="text-sm font-medium text-amber-800">Optimizing route...</p>
          <p class="text-xs text-amber-600">
            Status: {{ routeStore.optimizationStatus ?? 'processing' }}
          </p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Route Planner -->
      <RoutePlanner
        v-else
        :unassigned-shipments="shipmentStore.shipments"
        :vehicles="vehicleStore.vehicles"
        :drivers="driverStore.drivers"
        @save="handleSave"
        @optimize="handleOptimize"
      />
    </div>
  </AppLayout>
</template>
