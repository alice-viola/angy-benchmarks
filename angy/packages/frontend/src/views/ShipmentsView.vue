<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import DataTable from '@/components/common/DataTable.vue';
import type { ColumnDef } from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useShipmentStore, type Shipment } from '@/stores/shipment.store';

const router = useRouter();
const route = useRoute();
const store = useShipmentStore();

const columns: ColumnDef<Shipment>[] = [
  { key: 'reference_code', label: 'Reference', sortable: true },
  { key: 'origin_address', label: 'Pickup', sortable: true },
  { key: 'dest_address', label: 'Delivery', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'cargo_weight_kg', label: 'Weight (kg)', render: (r) => r.cargo_weight_kg?.toString() ?? '-' },
  { key: 'created_at', label: 'Created', sortable: true, render: (r) => new Date(r.created_at).toLocaleDateString() },
];

onMounted(() => {
  const status = (route.query.status ?? route.query.state) as string | undefined;
  store.fetchList({ page: 1, status });
});

function onPageChange(page: number) {
  store.fetchList({ page });
}

function onPageSizeChange(size: number) {
  store.fetchList({ page: 1, limit: size });
}

function onSortChange(sort: { field: string; direction: 'asc' | 'desc' | null }) {
  store.fetchList({ sort_field: sort.field, sort_direction: sort.direction ?? undefined });
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Shipments</h1>
      <router-link to="/shipments/new"
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
        Create Shipment
      </router-link>
    </div>
    <DataTable
      :columns="columns"
      :data="store.shipments"
      :loading="store.loading"
      :total-items="store.totalItems"
      :page="store.filters.page"
      :page-size="store.filters.limit"
      @update:page="onPageChange"
      @update:page-size="onPageSizeChange"
      @update:sort="onSortChange"
    />
  </div>
</template>
