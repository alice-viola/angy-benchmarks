<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from '@/components/common/DataTable.vue';
import type { ColumnDef } from '@/components/common/DataTable.vue';
import { useVehicleStore, type Vehicle } from '@/stores/vehicle.store';

const router = useRouter();
const store = useVehicleStore();

const columns: ColumnDef<Vehicle>[] = [
  { key: 'registration', label: 'Registration', sortable: true },
  { key: 'make', label: 'Make/Model/Year', render: (r) => `${r.make} ${r.model} ${r.year}` },
  { key: 'type', label: 'Type', sortable: true, render: (r) => r.type.charAt(0).toUpperCase() + r.type.slice(1) },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'capacity_kg', label: 'Capacity (kg)', render: (r) => r.capacity_kg?.toString() ?? '-' },
  { key: 'capacity_m3', label: 'Capacity (m³)', render: (r) => r.capacity_m3?.toString() ?? '-' },
];

onMounted(() => {
  store.fetchList();
});

function onPageChange(page: number) {
  store.fetchList({ page });
}

function onPageSizeChange(size: number) {
  store.fetchList({ page: 1, limit: size });
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Vehicles</h1>
    </div>
    <DataTable
      :columns="columns"
      :data="store.vehicles"
      :loading="store.loading"
      :total-items="store.totalItems"
      :page="store.filters.page"
      :page-size="store.filters.limit"
      @update:page="onPageChange"
      @update:page-size="onPageSizeChange"
    />
  </div>
</template>
