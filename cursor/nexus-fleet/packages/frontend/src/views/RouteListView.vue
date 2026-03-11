<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRouteStore } from '../stores/routes'
import { useVehicleStore } from '../stores/vehicles'
import { useDriverStore } from '../stores/drivers'
import type { Route } from '@nexus-fleet/shared'
import type { ColumnDef } from '../components/common/DataTable.vue'
import AppLayout from '../layouts/AppLayout.vue'
import DataTable from '../components/common/DataTable.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const router = useRouter()
const routeStore = useRouteStore()
const vehicleStore = useVehicleStore()
const driverStore = useDriverStore()

const page = ref(1)
const pageSize = ref(20)

function getVehiclePlate(r: Route): string {
  if (!r.vehicleId) return '—'
  const v = vehicleStore.vehicles.find(v => v.id === r.vehicleId)
  return v ? v.licensePlate : '—'
}

function getDriverName(r: Route): string {
  if (!r.driverId) return '—'
  const d = driverStore.drivers.find(d => d.id === r.driverId)
  return d ? `${d.firstName} ${d.lastName}` : '—'
}

const columns: ColumnDef<Route>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'vehicle', label: 'Vehicle', render: (row) => getVehiclePlate(row) },
  { key: 'driver', label: 'Driver', render: (row) => getDriverName(row) },
  { key: 'scheduledDate', label: 'Date', sortable: true },
  { key: 'totalDistanceKm', label: 'Distance', render: (row) => row.totalDistanceKm != null ? `${row.totalDistanceKm.toFixed(1)} km` : '—' },
  { key: 'stops', label: 'Stops', render: (row) => String(row.stops?.length ?? 0) },
]

async function loadRoutes() {
  await routeStore.fetchRoutes({ page: page.value, limit: pageSize.value })
}

function handleRowClick(r: Route) {
  router.push({ name: 'RouteDetail', params: { id: r.id } })
}

watch(page, loadRoutes)
watch(pageSize, () => { page.value = 1; loadRoutes() })

onMounted(async () => {
  await Promise.all([
    loadRoutes(),
    vehicleStore.fetchVehicles({ limit: 100 }),
    driverStore.fetchDrivers({ limit: 100 }),
  ])
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Routes</h1>
          <p class="mt-1 text-sm text-slate-500">
            {{ routeStore.pagination.total }} routes planned
          </p>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          @click="router.push({ name: 'RoutePlanner' })"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Plan New Route
        </button>
      </div>

      <!-- Loading -->
      <div v-if="routeStore.loading && routeStore.routes.length === 0" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Data Table -->
      <DataTable
        v-else
        :columns="columns"
        :data="routeStore.routes"
        :loading="routeStore.loading"
        :total-items="routeStore.pagination.total"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
        @update:page-size="pageSize = $event"
      >
        <template #cell-name="{ row }">
          <button
            class="font-medium text-primary-600 hover:text-primary-700 hover:underline"
            @click="handleRowClick(row)"
          >
            {{ row.name }}
          </button>
        </template>

        <template #cell-status="{ row }">
          <StatusBadge :status="row.status" variant="route" />
        </template>

        <template #cell-scheduledDate="{ value }">
          <span class="text-sm text-slate-700">
            {{ value ? new Date(value as string).toLocaleDateString() : '—' }}
          </span>
        </template>
      </DataTable>
    </div>
  </AppLayout>
</template>
