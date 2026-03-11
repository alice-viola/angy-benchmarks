<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useShipmentStore } from '@/stores/shipments'
import type { Shipment } from '@nexus-fleet/shared'
import type { ColumnDef } from '@/components/common/DataTable.vue'

const router = useRouter()
const shipmentStore = useShipmentStore()

const searchQuery = ref('')
const selectedStatuses = ref<string[]>([])
const selectedPriority = ref('')
const statusDropdownOpen = ref(false)

const STATUSES = [
  'draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'failed', 'cancelled',
]
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

const columns: ColumnDef<Shipment>[] = [
  { key: 'referenceCode', label: 'Reference', sortable: true },
  { key: 'customerName', label: 'Customer', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'origin', label: 'Origin' },
  { key: 'destination', label: 'Destination' },
  { key: 'createdAt', label: 'Created', sortable: true },
]

const filteredSearch = computed(() => searchQuery.value.trim())

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput(value: string) {
  searchQuery.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchData()
  }, 350)
}

function toggleStatus(status: string) {
  const idx = selectedStatuses.value.indexOf(status)
  if (idx === -1) {
    selectedStatuses.value.push(status)
  } else {
    selectedStatuses.value.splice(idx, 1)
  }
}

function clearStatusFilter() {
  selectedStatuses.value = []
}

watch([selectedStatuses, selectedPriority], () => {
  fetchData()
}, { deep: true })

function fetchData(page?: number) {
  shipmentStore.fetchShipments({
    page: page ?? 1,
    search: filteredSearch.value || undefined,
    status: selectedStatuses.value.length > 0 ? selectedStatuses.value.join(',') as any : undefined,
    priority: selectedPriority.value || undefined,
  } as any)
}

function onPageChange(page: number) {
  fetchData(page)
}

function onPageSizeChange(size: number) {
  shipmentStore.pagination.pageSize = size
  fetchData(1)
}

function navigateToDetail(row: Shipment) {
  router.push({ name: 'ShipmentDetail', params: { id: row.id } })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function closeStatusDropdown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('[data-status-dropdown]')) {
    statusDropdownOpen.value = false
  }
}

onMounted(() => {
  fetchData()
  document.addEventListener('click', closeStatusDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeStatusDropdown)
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Shipments</h1>
          <p class="mt-1 text-sm text-gray-500">
            Manage and track all your shipments
          </p>
        </div>
        <RouterLink
          to="/shipments/new"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Shipment
        </RouterLink>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <!-- Search -->
        <div class="relative flex-1">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            :value="searchQuery"
            type="text"
            placeholder="Search by reference, customer…"
            class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            @input="onSearchInput(($event.target as HTMLInputElement).value)"
          />
        </div>

        <!-- Status multi-select -->
        <div class="relative" data-status-dropdown>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            @click.stop="statusDropdownOpen = !statusDropdownOpen"
          >
            <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            Status
            <span
              v-if="selectedStatuses.length > 0"
              class="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-100 px-1.5 text-xs font-semibold text-primary-700"
            >
              {{ selectedStatuses.length }}
            </span>
            <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <Transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <div
              v-if="statusDropdownOpen"
              class="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
            >
              <div class="max-h-60 overflow-y-auto px-2 space-y-0.5">
                <label
                  v-for="status in STATUSES"
                  :key="status"
                  class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    :checked="selectedStatuses.includes(status)"
                    class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    @change="toggleStatus(status)"
                  />
                  <StatusBadge :status="status" />
                </label>
              </div>
              <div v-if="selectedStatuses.length > 0" class="mt-1 border-t border-gray-100 px-2 pt-2">
                <button
                  class="w-full rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  @click="clearStatusFilter"
                >
                  Clear all
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Priority select -->
        <select
          v-model="selectedPriority"
          class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Priorities</option>
          <option v-for="p in PRIORITIES" :key="p" :value="p">
            {{ p.charAt(0).toUpperCase() + p.slice(1) }}
          </option>
        </select>
      </div>

      <!-- Data table -->
      <DataTable
        :columns="columns"
        :data="shipmentStore.shipments"
        :loading="shipmentStore.loading"
        :total-items="shipmentStore.pagination.total"
        :page="shipmentStore.pagination.page"
        :page-size="shipmentStore.pagination.pageSize"
        @update:page="onPageChange"
        @update:page-size="onPageSizeChange"
      >
        <template #cell-referenceCode="{ row }">
          <button
            class="font-medium text-primary-600 hover:text-primary-700 hover:underline"
            @click="navigateToDetail(row)"
          >
            {{ (row as Shipment).referenceCode }}
          </button>
        </template>

        <template #cell-customerName="{ row }">
          <span class="text-gray-900">{{ (row as Shipment).customerName }}</span>
        </template>

        <template #cell-status="{ row }">
          <StatusBadge :status="(row as Shipment).status" variant="shipment" />
        </template>

        <template #cell-priority="{ row }">
          <span
            :class="[
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              (row as Shipment).priority === 'urgent' ? 'bg-red-100 text-red-700' :
              (row as Shipment).priority === 'high' ? 'bg-amber-100 text-amber-700' :
              (row as Shipment).priority === 'normal' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600',
            ]"
          >
            {{ (row as Shipment).priority }}
          </span>
        </template>

        <template #cell-origin="{ row }">
          <span class="max-w-[160px] truncate text-gray-600" :title="(row as Shipment).pickupAddress?.street">
            {{ (row as Shipment).pickupAddress?.city ?? (row as Shipment).pickupAddress?.street ?? '—' }}
          </span>
        </template>

        <template #cell-destination="{ row }">
          <span class="max-w-[160px] truncate text-gray-600" :title="(row as Shipment).deliveryAddress?.street">
            {{ (row as Shipment).deliveryAddress?.city ?? (row as Shipment).deliveryAddress?.street ?? '—' }}
          </span>
        </template>

        <template #cell-createdAt="{ row }">
          <span class="text-gray-500">{{ formatDate((row as Shipment).createdAt) }}</span>
        </template>
      </DataTable>
    </div>
  </AppLayout>
</template>
