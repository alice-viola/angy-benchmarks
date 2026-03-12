<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, Package } from 'lucide-vue-next';
import { useShipmentStore } from '../stores/shipments';
import DataTable, { type Column } from '../components/common/DataTable.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import type { ShipmentResponse } from '@nexusfleet/shared';

const router = useRouter();
const shipmentStore = useShipmentStore();
const error = ref('');

const columns: Column[] = [
  { key: 'reference_code', label: 'Reference', sortable: true },
  { key: 'customer_name', label: 'Customer', sortable: true, filterable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'priority', label: 'Priority' },
  { key: 'origin_address', label: 'Origin' },
  { key: 'dest_address', label: 'Destination' },
  { key: 'created_at', label: 'Created', sortable: true, align: 'right' },
];

onMounted(async () => {
  try {
    await shipmentStore.list({ page: 1, page_size: 25 });
  } catch {
    error.value = 'Failed to load shipments';
  }
});

function handlePageChange(page: number) {
  shipmentStore.list({ page, page_size: shipmentStore.pagination.page_size });
}

function handlePageSizeChange(pageSize: number) {
  shipmentStore.list({ page: 1, page_size: pageSize });
}

function handleSort(sort: { key: string; direction: 'asc' | 'desc' }) {
  const prefix = sort.direction === 'desc' ? '-' : '';
  shipmentStore.list({ sort: `${prefix}${sort.key}`, page: 1, page_size: shipmentStore.pagination.page_size });
}

function handleRowClick(item: ShipmentResponse) {
  router.push(`/shipments/${item.id}`);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">Shipments</h1>
        <p class="text-sm text-neutral-400 mt-1">Manage and track all shipments</p>
      </div>
      <RouterLink
        to="/shipments/create"
        class="bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-all duration-150 flex items-center gap-2"
      >
        <Plus class="w-[18px] h-[18px]" />
        Create Shipment
      </RouterLink>
    </div>

    <DataTable
      :columns="columns"
      :data="shipmentStore.shipments"
      :loading="shipmentStore.loading"
      :total-items="shipmentStore.pagination.total_items"
      :page="shipmentStore.pagination.page"
      :page-size="shipmentStore.pagination.page_size"
      :navigable="true"
      empty-title="No shipments yet"
      empty-description="Create your first shipment to start tracking deliveries across your fleet."
      @update:page="handlePageChange"
      @update:page-size="handlePageSizeChange"
      @update:sort="handleSort"
      @row-click="handleRowClick"
    >
      <template #empty-icon>
        <Package class="w-8 h-8 text-neutral-300" />
      </template>
      <template #empty-action>
        <RouterLink
          to="/shipments/create"
          class="bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-all duration-150 flex items-center gap-2"
        >
          <Plus class="w-[18px] h-[18px]" />
          Create Shipment
        </RouterLink>
      </template>

      <template #cell-reference_code="{ value }">
        <span class="font-mono text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
          {{ value || 'Draft' }}
        </span>
      </template>
      <template #cell-status="{ value }">
        <StatusBadge :status="String(value)" />
      </template>
      <template #cell-priority="{ value }">
        <span
          :class="[
            'rounded-md px-2 py-0.5 text-xs font-bold uppercase',
            value === 'critical' ? 'bg-danger-50 text-danger-700 ring-1 ring-danger-200' :
            value === 'high' ? 'bg-warning-50 text-warning-700 ring-1 ring-warning-200' :
            value === 'normal' ? 'bg-info-50 text-info-600' :
            'bg-neutral-100 text-neutral-500',
          ]"
        >
          {{ value }}
        </span>
      </template>
      <template #cell-created_at="{ value }">
        <span class="text-xs text-neutral-400">{{ formatDate(String(value)) }}</span>
      </template>
    </DataTable>
  </div>
</template>
