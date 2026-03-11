<script setup lang="ts">
import { onMounted } from 'vue';
import DataTable from '@/components/common/DataTable.vue';
import type { ColumnDef } from '@/components/common/DataTable.vue';
import { useGeofenceStore, type Geofence } from '@/stores/geofence.store';

const store = useGeofenceStore();

const columns: ColumnDef<Geofence>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'type', label: 'Type', render: (r) => r.type.charAt(0).toUpperCase() + r.type.slice(1) },
  { key: 'radius_meters', label: 'Radius (m)', render: (r) => r.radius_meters?.toString() ?? '-' },
  { key: 'trigger_on_enter', label: 'Enter', render: (r) => r.trigger_on_enter ? 'Yes' : 'No' },
  { key: 'trigger_on_exit', label: 'Exit', render: (r) => r.trigger_on_exit ? 'Yes' : 'No' },
  { key: 'is_active', label: 'Active', render: (r) => r.is_active ? 'Active' : 'Inactive' },
];

onMounted(() => { store.fetchList(); });

function onPageChange(page: number) { store.fetchList({ page }); }
function onPageSizeChange(size: number) { store.fetchList({ page: 1, limit: size }); }
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Geofences</h1>
      <router-link to="/geofences/new"
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
        New Geofence
      </router-link>
    </div>
    <DataTable :columns="columns" :data="store.geofences" :loading="store.loading"
      :total-items="store.totalItems" :page="store.filters.page" :page-size="store.filters.limit"
      @update:page="onPageChange" @update:page-size="onPageSizeChange" />
  </div>
</template>
