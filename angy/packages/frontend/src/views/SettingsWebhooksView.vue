<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/plugins/axios';
import { useToastStore } from '@/stores/toast.store';
import DataTable from '@/components/common/DataTable.vue';
import type { ColumnDef } from '@/components/common/DataTable.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';

const toast = useToastStore();

interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret?: string;
  last_failure: string | null;
}

const webhooks = ref<Webhook[]>([]);
const totalItems = ref(0);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);

// Create dialog
const showCreate = ref(false);
const newUrl = ref('');
const newEvents = ref<string[]>([]);
const eventTypes = ['shipment.updated', 'vehicle.updated', 'driver.updated', 'geofence.triggered'];

// Secret dialog
const showSecret = ref(false);
const revealedSecret = ref('');

// Delete dialog
const showDelete = ref(false);
const deleteId = ref('');

// Test
const testResults = ref<Record<string, { status_code: number; response_time_ms: number }>>({});

const columns: ColumnDef<Webhook>[] = [
  { key: 'url', label: 'URL' },
  { key: 'events', label: 'Events', render: (r) => r.events.join(', ') },
  { key: 'is_active', label: 'Active', render: (r) => r.is_active ? 'Yes' : 'No' },
  { key: 'last_failure', label: 'Last Failure', render: (r) => r.last_failure ?? '-' },
];

onMounted(() => fetchWebhooks());

async function fetchWebhooks() {
  loading.value = true;
  try {
    const res = await api.get('/api/v1/webhooks', { params: { page: page.value, limit: pageSize.value } });
    webhooks.value = res.data.data ?? [];
    totalItems.value = res.data.meta?.total ?? webhooks.value.length;
  } catch {
    toast.show('Failed to load webhooks', 'error');
  } finally {
    loading.value = false;
  }
}

async function createWebhook() {
  try {
    const res = await api.post('/api/v1/webhooks', { url: newUrl.value, events: newEvents.value });
    const data = res.data.data ?? res.data;
    if (data.secret) {
      revealedSecret.value = data.secret;
      showSecret.value = true;
    }
    showCreate.value = false;
    newUrl.value = '';
    newEvents.value = [];
    toast.show('Webhook created', 'success');
    fetchWebhooks();
  } catch {
    toast.show('Failed to create webhook', 'error');
  }
}

async function testWebhook(id: string) {
  try {
    const res = await api.post(`/api/v1/webhooks/${id}/test`);
    const data = res.data.data ?? res.data;
    testResults.value[id] = { status_code: data.status_code, response_time_ms: data.response_time_ms };
  } catch {
    toast.show('Test failed', 'error');
  }
}

async function confirmDelete() {
  try {
    await api.delete(`/api/v1/webhooks/${deleteId.value}`);
    toast.show('Webhook deleted', 'success');
    showDelete.value = false;
    fetchWebhooks();
  } catch {
    toast.show('Failed to delete webhook', 'error');
  }
}

function copySecret() {
  navigator.clipboard.writeText(revealedSecret.value);
  toast.show('Secret copied', 'success');
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Webhooks</h1>
      <button @click="showCreate = true"
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
        Add Webhook
      </button>
    </div>

    <DataTable :columns="columns" :data="webhooks" :loading="loading"
      :total-items="totalItems" :page="page" :page-size="pageSize"
      @update:page="(p) => { page = p; fetchWebhooks(); }"
      @update:page-size="(s) => { pageSize = s; page = 1; fetchWebhooks(); }" />

    <!-- Per-webhook action buttons -->
    <div v-if="webhooks.length > 0" class="mt-4 space-y-2">
      <div v-for="wh in webhooks" :key="wh.id" class="flex items-center gap-2 text-sm">
        <span class="text-slate-600 truncate max-w-xs">{{ wh.url }}</span>
        <button class="px-2 py-1 text-xs bg-slate-100 rounded hover:bg-slate-200" @click="testWebhook(wh.id)">Test</button>
        <span v-if="testResults[wh.id]" class="text-xs text-slate-500">
          {{ testResults[wh.id].status_code }} ({{ testResults[wh.id].response_time_ms }}ms)
        </span>
        <button class="px-2 py-1 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100"
          @click="deleteId = wh.id; showDelete = true">Delete</button>
      </div>
    </div>

    <!-- Create Dialog -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="showCreate = false" />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h3 class="text-lg font-semibold text-slate-900 mb-4">Add Webhook</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">URL</label>
              <input v-model="newUrl" type="url" placeholder="https://..."
                class="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Events</label>
              <div class="space-y-1">
                <label v-for="ev in eventTypes" :key="ev" class="flex items-center gap-2 text-sm">
                  <input type="checkbox" :value="ev" v-model="newEvents" class="rounded border-slate-300" />
                  {{ ev }}
                </label>
              </div>
            </div>
          </div>
          <div class="mt-6 flex justify-end space-x-3">
            <button class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200" @click="showCreate = false">Cancel</button>
            <button class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700" :disabled="!newUrl || newEvents.length === 0" @click="createWebhook">Create</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Secret Dialog -->
    <Teleport to="body">
      <div v-if="showSecret" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h3 class="text-lg font-semibold text-slate-900 mb-2">Webhook Secret</h3>
          <p class="text-sm text-slate-600 mb-3">This secret will only be shown once. Copy it now.</p>
          <div class="flex gap-2">
            <code class="flex-1 px-3 py-2 bg-slate-100 rounded text-sm break-all">{{ revealedSecret }}</code>
            <button class="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" @click="copySecret">Copy</button>
          </div>
          <div class="mt-4 flex justify-end">
            <button class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
              @click="showSecret = false; revealedSecret = ''">Done</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm -->
    <ConfirmDialog :open="showDelete" title="Delete Webhook" message="Are you sure you want to delete this webhook?"
      @confirm="confirmDelete" @cancel="showDelete = false" />
  </div>
</template>
