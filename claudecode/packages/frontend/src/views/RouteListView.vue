<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRoutesStore } from '@/stores/routes';
import { ROUTE_STATUSES } from '@nexus-fleet/shared';
import AppLayout from '@/layouts/AppLayout.vue';
import DataTable from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { ColumnDef, Route } from '@/types';

const router = useRouter();
const routesStore = useRoutesStore();

const page = ref(1);
const pageSize = ref(25);
const statusFilter = ref('');
const searchQuery = ref('');

const columns: ColumnDef<Route>[] = [
  { key: 'name', label: 'Name', sortable: true, filterable: true },
  { key: 'status', label: 'Status', sortable: true },
  {
    key: 'planned_date',
    label: 'Planned Date',
    sortable: true,
    render: (v: string) => new Date(v).toLocaleDateString(),
  },
  {
    key: 'estimated_distance_km',
    label: 'Distance (km)',
    sortable: true,
    render: (v: number | undefined) => v != null ? v.toFixed(1) : '-',
  },
  {
    key: 'stops',
    label: 'Stops',
    render: (v: any[]) => String(v?.length || 0),
  },
  {
    key: 'created_at',
    label: 'Created',
    sortable: true,
    render: (v: string) => new Date(v).toLocaleDateString(),
  },
];

async function fetchData() {
  await routesStore.fetchRoutes({
    page: page.value,
    pageSize: pageSize.value,
    status: statusFilter.value || undefined,
    search: searchQuery.value || undefined,
  });
}

function handleRowClick(row: Route) {
  router.push(`/routes/${row.id}`);
}

watch([page, pageSize, statusFilter, searchQuery], fetchData);
onMounted(fetchData);
</script>

<template>
  <AppLayout>
    <div class="space-y-4">
      <div class="page-header">
        <h1 class="page-title">Routes</h1>
        <router-link to="/routes/new" class="btn-primary">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Plan Route
        </router-link>
      </div>

      <div class="card !p-4">
        <div class="flex flex-wrap items-center gap-3">
          <input v-model="searchQuery" type="text" class="input max-w-xs" placeholder="Search routes..." />
          <select v-model="statusFilter" class="input max-w-[180px]">
            <option value="">All Statuses</option>
            <option v-for="s in ROUTE_STATUSES" :key="s" :value="s">
              {{ s.charAt(0).toUpperCase() + s.slice(1) }}
            </option>
          </select>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :data="routesStore.routes"
        :loading="routesStore.loading"
        :total-items="routesStore.pagination.totalItems"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
        @update:page-size="pageSize = $event; page = 1"
        @row-click="handleRowClick"
      >
        <template #cell-status="{ value }">
          <StatusBadge :status="value" type="route" />
        </template>
      </DataTable>
    </div>
  </AppLayout>
</template>
