<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDriverStore } from '../stores/drivers'
import { useVehicleStore } from '../stores/vehicles'
import { DRIVER_STATUSES } from '@nexus-fleet/shared'
import type { Driver } from '@nexus-fleet/shared'
import type { ColumnDef } from '../components/common/DataTable.vue'
import AppLayout from '../layouts/AppLayout.vue'
import DataTable from '../components/common/DataTable.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const router = useRouter()
const driverStore = useDriverStore()
const vehicleStore = useVehicleStore()

const statusFilter = ref('')
const searchQuery = ref('')
const page = ref(1)
const pageSize = ref(20)

const MAX_DAILY_HOURS = 11

function getVehiclePlate(driver: Driver): string {
  if (!driver.currentVehicleId) return '—'
  const v = vehicleStore.vehicles.find(v => v.id === driver.currentVehicleId)
  return v ? v.licensePlate : '—'
}

function estimatedHours(driver: Driver): string {
  if (driver.status === 'driving') return '~6h'
  if (driver.status === 'on_break') return '~4h'
  return '0h'
}

const columns: ColumnDef<Driver>[] = [
  { key: 'name', label: 'Name', sortable: true, render: (row) => `${row.firstName} ${row.lastName}` },
  { key: 'licenseNumber', label: 'Employee ID', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'licenseClass', label: 'License Classes' },
  { key: 'currentVehicle', label: 'Current Vehicle', render: (row) => getVehiclePlate(row) },
  { key: 'drivingHours', label: 'Driving Hours', render: (row) => estimatedHours(row) },
]

async function loadDrivers() {
  const params: Record<string, unknown> = { page: page.value, limit: pageSize.value }
  if (statusFilter.value) params.status = statusFilter.value
  if (searchQuery.value) params.search = searchQuery.value
  await driverStore.fetchDrivers(params)
}

function handleRowClick(driver: Driver) {
  router.push({ name: 'DriverDetail', params: { id: driver.id } })
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadDrivers()
  }, 300)
}

watch(statusFilter, () => { page.value = 1; loadDrivers() })
watch(page, loadDrivers)
watch(pageSize, () => { page.value = 1; loadDrivers() })

onMounted(async () => {
  await Promise.all([loadDrivers(), vehicleStore.fetchVehicles({ limit: 100 })])
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Drivers</h1>
        <p class="mt-1 text-sm text-slate-500">
          {{ driverStore.pagination.total }} drivers registered
        </p>
      </div>

      <!-- Filter Bar -->
      <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <select
          v-model="statusFilter"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option v-for="s in DRIVER_STATUSES" :key="s" :value="s">
            {{ s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }}
          </option>
        </select>

        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name, license..."
            class="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            @input="onSearchInput"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="driverStore.loading && driverStore.drivers.length === 0" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Data Table -->
      <DataTable
        v-else
        :columns="columns"
        :data="driverStore.drivers"
        :loading="driverStore.loading"
        :total-items="driverStore.pagination.total"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
        @update:page-size="pageSize = $event"
      >
        <template #cell-status="{ row }">
          <StatusBadge :status="row.status" variant="driver" />
        </template>

        <template #cell-name="{ row }">
          <button
            class="font-medium text-primary-600 hover:text-primary-700 hover:underline"
            @click="handleRowClick(row)"
          >
            {{ row.firstName }} {{ row.lastName }}
          </button>
        </template>

        <template #cell-licenseClass="{ row }">
          <div class="flex gap-1">
            <span
              v-for="cls in row.licenseClass.split(',')"
              :key="cls"
              class="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700"
            >
              {{ cls.trim() }}
            </span>
          </div>
        </template>

        <template #cell-drivingHours="{ row }">
          <div class="flex items-center gap-2">
            <div class="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all"
                :class="row.status === 'driving' ? 'bg-blue-500' : 'bg-slate-300'"
                :style="{ width: row.status === 'driving' ? '55%' : row.status === 'on_break' ? '36%' : '0%' }"
              />
            </div>
            <span class="text-xs text-slate-500">{{ estimatedHours(row) }} / {{ MAX_DAILY_HOURS }}h</span>
          </div>
        </template>
      </DataTable>
    </div>
  </AppLayout>
</template>
