<script setup lang="ts">
import { onMounted } from 'vue';
import DataTable from '@/components/common/DataTable.vue';
import type { ColumnDef } from '@/components/common/DataTable.vue';
import { useDriverStore, type Driver } from '@/stores/driver.store';

const store = useDriverStore();

const columns: ColumnDef<Driver>[] = [
  { key: 'first_name', label: 'Name', sortable: true, render: (r) => `${r.first_name} ${r.last_name}` },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'license_number', label: 'License #' },
  { key: 'license_class', label: 'License Class' },
  { key: 'vehicle_id', label: 'Vehicle', render: (r) => r.vehicle?.registration ?? 'None' },
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
      <h1 class="text-2xl font-bold text-slate-900">Drivers</h1>
    </div>
    <DataTable
      :columns="columns"
      :data="store.drivers"
      :loading="store.loading"
      :total-items="store.totalItems"
      :page="store.filters.page"
      :page-size="store.filters.limit"
      @update:page="onPageChange"
      @update:page-size="onPageSizeChange"
    />
  </div>
</template>
