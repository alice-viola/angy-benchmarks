<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useVehicleStore } from '../stores/vehicles'
import { VEHICLE_STATUSES, VEHICLE_TYPES } from '@nexus-fleet/shared'
import type { Vehicle } from '@nexus-fleet/shared'
import type { ColumnDef } from '../components/common/DataTable.vue'
import AppLayout from '../layouts/AppLayout.vue'
import DataTable from '../components/common/DataTable.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const router = useRouter()
const vehicleStore = useVehicleStore()

const statusFilter = ref('')
const typeFilter = ref('')
const searchQuery = ref('')
const page = ref(1)
const pageSize = ref(20)

const columns: ColumnDef<Vehicle>[] = [
  { key: 'licensePlate', label: 'Registration', sortable: true },
  { key: 'makeModel', label: 'Make / Model', sortable: true, render: (row) => `${row.make} ${row.model}` },
  { key: 'type', label: 'Type', sortable: true, render: (row) => row.type.charAt(0).toUpperCase() + row.type.slice(1) },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'lastLocation', label: 'Last Location', render: (row) => row.currentLat != null && row.currentLng != null ? `${row.currentLat.toFixed(4)}, ${row.currentLng.toFixed(4)}` : '—' },
  { key: 'currentSpeed', label: 'Speed', sortable: true, render: (row) => row.currentSpeed != null ? `${Math.round(row.currentSpeed)} km/h` : '—' },
]

async function loadVehicles() {
  const params: Record<string, unknown> = { page: page.value, limit: pageSize.value }
  if (statusFilter.value) params.status = statusFilter.value
  if (typeFilter.value) params.type = typeFilter.value
  if (searchQuery.value) params.search = searchQuery.value
  await vehicleStore.fetchVehicles(params)
}

function handleRowClick(vehicle: Vehicle) {
  router.push({ name: 'VehicleDetail', params: { id: vehicle.id } })
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadVehicles()
  }, 300)
}

watch([statusFilter, typeFilter], () => {
  page.value = 1
  loadVehicles()
})

watch(page, loadVehicles)
watch(pageSize, () => { page.value = 1; loadVehicles() })

onMounted(loadVehicles)
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Vehicles</h1>
          <p class="mt-1 text-sm text-slate-500">
            {{ vehicleStore.pagination.total }} vehicles in your fleet
          </p>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <select
          v-model="statusFilter"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option v-for="s in VEHICLE_STATUSES" :key="s" :value="s">
            {{ s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }}
          </option>
        </select>

        <select
          v-model="typeFilter"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Types</option>
          <option v-for="t in VEHICLE_TYPES" :key="t" :value="t">
            {{ t.charAt(0).toUpperCase() + t.slice(1) }}
          </option>
        </select>

        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by plate, make, model..."
            class="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            @input="onSearchInput"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="vehicleStore.loading && vehicleStore.vehicles.length === 0" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Data Table -->
      <DataTable
        v-else
        :columns="columns"
        :data="vehicleStore.vehicles"
        :loading="vehicleStore.loading"
        :total-items="vehicleStore.pagination.total"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
        @update:page-size="pageSize = $event"
      >
        <template #cell-status="{ row }">
          <StatusBadge :status="row.status" variant="vehicle" />
        </template>

        <template #cell-licensePlate="{ row }">
          <button
            class="font-medium text-primary-600 hover:text-primary-700 hover:underline"
            @click="handleRowClick(row)"
          >
            {{ row.licensePlate }}
          </button>
        </template>
      </DataTable>
    </div>
  </AppLayout>
</template>
