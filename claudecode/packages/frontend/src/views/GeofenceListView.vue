<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGeofencesStore } from '@/stores/geofences';
import AppLayout from '@/layouts/AppLayout.vue';
import DataTable from '@/components/common/DataTable.vue';
import Modal from '@/components/common/Modal.vue';
import type { ColumnDef, Geofence } from '@/types';

const router = useRouter();
const geofencesStore = useGeofencesStore();

const page = ref(1);
const pageSize = ref(25);
const searchQuery = ref('');
const deleteModal = ref(false);
const deleteTarget = ref<Geofence | null>(null);

const columns: ColumnDef<Geofence>[] = [
  { key: 'name', label: 'Name', sortable: true, filterable: true },
  { key: 'radius_m', label: 'Radius (m)', sortable: true },
  {
    key: 'trigger_on_enter',
    label: 'Enter',
    render: (v: boolean) => v ? 'Yes' : 'No',
  },
  {
    key: 'trigger_on_exit',
    label: 'Exit',
    render: (v: boolean) => v ? 'Yes' : 'No',
  },
  {
    key: 'is_active',
    label: 'Active',
    render: (v: boolean) => v ? 'Yes' : 'No',
  },
  {
    key: 'created_at',
    label: 'Created',
    sortable: true,
    render: (v: string) => new Date(v).toLocaleDateString(),
  },
];

async function fetchData() {
  await geofencesStore.fetchGeofences({
    page: page.value,
    pageSize: pageSize.value,
    search: searchQuery.value || undefined,
  });
}

function handleRowClick(row: Geofence) {
  router.push(`/geofences/${row.id}/edit`);
}

function confirmDelete(geofence: Geofence) {
  deleteTarget.value = geofence;
  deleteModal.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  await geofencesStore.deleteGeofence(deleteTarget.value.id);
  deleteModal.value = false;
  deleteTarget.value = null;
}

watch([page, pageSize, searchQuery], fetchData);
onMounted(fetchData);
</script>

<template>
  <AppLayout>
    <div class="space-y-4">
      <div class="page-header">
        <h1 class="page-title">Geofences</h1>
        <router-link to="/geofences/new" class="btn-primary">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Geofence
        </router-link>
      </div>

      <div class="card !p-4">
        <input v-model="searchQuery" type="text" class="input max-w-xs" placeholder="Search geofences..." />
      </div>

      <DataTable
        :columns="columns"
        :data="geofencesStore.geofences"
        :loading="geofencesStore.loading"
        :total-items="geofencesStore.pagination.totalItems"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
        @update:page-size="pageSize = $event; page = 1"
        @row-click="handleRowClick"
      >
        <template #cell-name="{ row, value }">
          <div class="flex items-center gap-2">
            <div class="h-3 w-3 rounded-full" :style="{ backgroundColor: (row as Geofence).color }" />
            {{ value }}
          </div>
        </template>
      </DataTable>
    </div>

    <Modal :open="deleteModal" title="Delete Geofence" @close="deleteModal = false">
      <p class="text-sm text-gray-600">
        Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>? This action cannot be undone.
      </p>
      <template #footer>
        <button class="btn-secondary" @click="deleteModal = false">Cancel</button>
        <button class="btn-danger" @click="handleDelete">Delete</button>
      </template>
    </Modal>
  </AppLayout>
</template>
