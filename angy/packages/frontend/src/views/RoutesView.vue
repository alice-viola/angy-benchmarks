<script setup lang="ts">
import { onMounted } from 'vue';
import DataTable from '@/components/common/DataTable.vue';
import type { ColumnDef } from '@/components/common/DataTable.vue';
import { useRouteStore, type Route } from '@/stores/route.store';

const store = useRouteStore();

const columns: ColumnDef<Route>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'planned_date', label: 'Planned Date', render: (r) => r.planned_date ? new Date(r.planned_date).toLocaleDateString() : '-' },
  { key: 'vehicle_id', label: 'Vehicle', render: (r) => r.vehicle?.registration ?? '-' },
  { key: 'driver_id', label: 'Driver', render: (r) => r.driver ? `${r.driver.first_name} ${r.driver.last_name}` : '-' },
  { key: 'estimated_distance_km', label: 'Distance (km)', render: (r) => r.estimated_distance_km?.toFixed(1) ?? '-' },
];

onMounted(() => { store.fetchList(); });

function onPageChange(page: number) { store.fetchList({ page }); }
function onPageSizeChange(size: number) { store.fetchList({ page: 1, limit: size }); }
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Routes</h1>
      <router-link to="/routes/new"
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
        New Route
      </router-link>
    </div>
    <DataTable :columns="columns" :data="store.routes" :loading="store.loading"
      :total-items="store.totalItems" :page="store.filters.page" :page-size="store.filters.limit"
      @update:page="onPageChange" @update:page-size="onPageSizeChange" />
  </div>
</template>
