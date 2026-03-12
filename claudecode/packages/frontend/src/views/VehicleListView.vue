<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useVehiclesStore } from '@/stores/vehicles';
import { VEHICLE_STATUSES } from '@nexus-fleet/shared';
import AppLayout from '@/layouts/AppLayout.vue';
import DataTable from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { ColumnDef, Vehicle } from '@/types';

const router = useRouter();
const vehiclesStore = useVehiclesStore();

const page = ref(1);
const pageSize = ref(25);
const statusFilter = ref('');
const searchQuery = ref('');

const columns: ColumnDef<Vehicle>[] = [
  { key: 'registration', label: 'Registration', sortable: true, filterable: true },
  { key: 'make', label: 'Make', sortable: true },
  { key: 'model', label: 'Model', sortable: true },
  { key: 'year', label: 'Year', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'capacity_kg', label: 'Capacity (kg)', sortable: true },
];

async function fetchData() {
  await vehiclesStore.fetchVehicles({
    page: page.value,
    pageSize: pageSize.value,
    status: statusFilter.value || undefined,
    search: searchQuery.value || undefined,
  });
}

function handleRowClick(row: Vehicle) {
  router.push(`/vehicles/${row.id}`);
}

watch([page, pageSize, statusFilter, searchQuery], fetchData);
onMounted(fetchData);
</script>

<template>
  <AppLayout>
    <div class="space-y-4">
      <div class="page-header">
        <h1 class="page-title">Vehicles</h1>
      </div>

      <div class="card !p-4">
        <div class="flex flex-wrap items-center gap-3">
          <input v-model="searchQuery" type="text" class="input max-w-xs" placeholder="Search vehicles..." />
          <select v-model="statusFilter" class="input max-w-[180px]">
            <option value="">All Statuses</option>
            <option v-for="s in VEHICLE_STATUSES" :key="s" :value="s">
              {{ s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) }}
            </option>
          </select>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :data="vehiclesStore.vehicles"
        :loading="vehiclesStore.loading"
        :total-items="vehiclesStore.pagination.totalItems"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
        @update:page-size="pageSize = $event; page = 1"
        @row-click="handleRowClick"
      >
        <template #cell-status="{ value }">
          <StatusBadge :status="value" type="vehicle" />
        </template>
        <template #cell-type="{ value }">
          <span class="capitalize">{{ value }}</span>
        </template>
      </DataTable>
    </div>
  </AppLayout>
</template>
