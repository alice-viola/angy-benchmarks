<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDriversStore } from '@/stores/drivers';
import { DRIVER_STATUSES } from '@nexus-fleet/shared';
import AppLayout from '@/layouts/AppLayout.vue';
import DataTable from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { ColumnDef, Driver } from '@/types';

const router = useRouter();
const driversStore = useDriversStore();

const page = ref(1);
const pageSize = ref(25);
const statusFilter = ref('');
const searchQuery = ref('');

const columns: ColumnDef<Driver>[] = [
  { key: 'employee_id', label: 'Employee ID', sortable: true, filterable: true },
  { key: 'first_name', label: 'First Name', sortable: true, filterable: true },
  { key: 'last_name', label: 'Last Name', sortable: true, filterable: true },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'license_number', label: 'License', sortable: false },
  {
    key: 'license_expiry',
    label: 'License Expiry',
    sortable: true,
    render: (v: string) => new Date(v).toLocaleDateString(),
  },
];

async function fetchData() {
  await driversStore.fetchDrivers({
    page: page.value,
    pageSize: pageSize.value,
    status: statusFilter.value || undefined,
    search: searchQuery.value || undefined,
  });
}

function handleRowClick(row: Driver) {
  router.push(`/drivers/${row.id}`);
}

watch([page, pageSize, statusFilter, searchQuery], fetchData);
onMounted(fetchData);
</script>

<template>
  <AppLayout>
    <div class="space-y-4">
      <div class="page-header">
        <h1 class="page-title">Drivers</h1>
      </div>

      <div class="card !p-4">
        <div class="flex flex-wrap items-center gap-3">
          <input v-model="searchQuery" type="text" class="input max-w-xs" placeholder="Search drivers..." />
          <select v-model="statusFilter" class="input max-w-[180px]">
            <option value="">All Statuses</option>
            <option v-for="s in DRIVER_STATUSES" :key="s" :value="s">
              {{ s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) }}
            </option>
          </select>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :data="driversStore.drivers"
        :loading="driversStore.loading"
        :total-items="driversStore.pagination.totalItems"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
        @update:page-size="pageSize = $event; page = 1"
        @row-click="handleRowClick"
      >
        <template #cell-status="{ value }">
          <StatusBadge :status="value" type="driver" />
        </template>
      </DataTable>
    </div>
  </AppLayout>
</template>
