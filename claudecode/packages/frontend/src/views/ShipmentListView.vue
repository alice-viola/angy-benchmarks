<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useShipmentsStore } from '@/stores/shipments';
import { SHIPMENT_STATUSES, PRIORITIES } from '@nexus-fleet/shared';
import AppLayout from '@/layouts/AppLayout.vue';
import DataTable from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { ColumnDef, Shipment } from '@/types';

const router = useRouter();
const shipmentsStore = useShipmentsStore();

const page = ref(1);
const pageSize = ref(25);
const statusFilter = ref('');
const priorityFilter = ref('');
const searchQuery = ref('');

const columns: ColumnDef<Shipment>[] = [
  { key: 'reference_code', label: 'Reference', sortable: true, filterable: true },
  { key: 'customer_name', label: 'Customer', sortable: true, filterable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'origin_address', label: 'Origin', sortable: false },
  { key: 'dest_address', label: 'Destination', sortable: false },
  { key: 'cargo_weight_kg', label: 'Weight (kg)', sortable: true },
  { key: 'created_at', label: 'Created', sortable: true, render: (v: string) => new Date(v).toLocaleDateString() },
];

async function fetchData() {
  await shipmentsStore.fetchShipments({
    page: page.value,
    pageSize: pageSize.value,
    status: statusFilter.value || undefined,
    priority: priorityFilter.value || undefined,
    search: searchQuery.value || undefined,
  });
}

function handleRowClick(row: Shipment) {
  router.push(`/shipments/${row.id}`);
}

watch([page, pageSize, statusFilter, priorityFilter, searchQuery], fetchData);

onMounted(fetchData);
</script>

<template>
  <AppLayout>
    <div class="space-y-4">
      <div class="page-header">
        <h1 class="page-title">Shipments</h1>
        <router-link to="/shipments/new" class="btn-primary">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Shipment
        </router-link>
      </div>

      <!-- Filters -->
      <div class="card !p-4">
        <div class="flex flex-wrap items-center gap-3">
          <input
            v-model="searchQuery"
            type="text"
            class="input max-w-xs"
            placeholder="Search shipments..."
          />
          <select v-model="statusFilter" class="input max-w-[180px]">
            <option value="">All Statuses</option>
            <option v-for="s in SHIPMENT_STATUSES" :key="s" :value="s">
              {{ s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) }}
            </option>
          </select>
          <select v-model="priorityFilter" class="input max-w-[160px]">
            <option value="">All Priorities</option>
            <option v-for="p in PRIORITIES" :key="p" :value="p">
              {{ p.charAt(0).toUpperCase() + p.slice(1) }}
            </option>
          </select>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :data="shipmentsStore.shipments"
        :loading="shipmentsStore.loading"
        :total-items="shipmentsStore.pagination.totalItems"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
        @update:page-size="pageSize = $event; page = 1"
        @row-click="handleRowClick"
      >
        <template #cell-status="{ value }">
          <StatusBadge :status="value" type="shipment" />
        </template>
        <template #cell-priority="{ value }">
          <StatusBadge :status="value" />
        </template>
      </DataTable>
    </div>
  </AppLayout>
</template>
