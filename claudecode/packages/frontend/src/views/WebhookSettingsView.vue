<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { webhookCreateSchema } from '@nexus-fleet/shared';
import { useApi } from '@/composables/useApi';
import AppLayout from '@/layouts/AppLayout.vue';
import Modal from '@/components/common/Modal.vue';
import type { Webhook } from '@/types';

const api = useApi();
const webhooks = ref<Webhook[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const creating = ref(false);

const eventOptions = [
  'shipment.created',
  'shipment.status_changed',
  'shipment.delivered',
  'vehicle.location_updated',
  'geofence.enter',
  'geofence.exit',
  'route.optimized',
];

const schema = toTypedSchema(webhookCreateSchema);
const { handleSubmit, errors, resetForm } = useForm({ validationSchema: schema });
const { value: url } = useField<string>('url');
const { value: events } = useField<string[]>('events');
const { value: is_active } = useField<boolean>('is_active');

async function fetchWebhooks() {
  loading.value = true;
  try {
    const response = await api.get<Webhook[]>('/webhooks');
    if (response.success) {
      webhooks.value = response.data;
    }
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  resetForm({
    values: { url: '', events: [], is_active: true },
  });
  showCreateModal.value = true;
}

const onSubmit = handleSubmit(async (values) => {
  creating.value = true;
  try {
    const response = await api.post<Webhook>('/webhooks', values);
    if (response.success) {
      webhooks.value.unshift(response.data);
      showCreateModal.value = false;
    }
  } finally {
    creating.value = false;
  }
});

async function toggleActive(webhook: Webhook) {
  const response = await api.put<Webhook>(`/webhooks/${webhook.id}`, {
    is_active: !webhook.is_active,
  });
  if (response.success) {
    const index = webhooks.value.findIndex((w) => w.id === webhook.id);
    if (index !== -1) {
      webhooks.value[index] = response.data;
    }
  }
}

async function deleteWebhook(id: string) {
  const response = await api.del(`/webhooks/${id}`);
  if (response.success) {
    webhooks.value = webhooks.value.filter((w) => w.id !== id);
  }
}

function toggleEvent(event: string) {
  if (!events.value) events.value = [];
  const idx = events.value.indexOf(event);
  if (idx >= 0) {
    events.value.splice(idx, 1);
  } else {
    events.value.push(event);
  }
}

onMounted(fetchWebhooks);
</script>

<template>
  <AppLayout>
    <div class="max-w-4xl space-y-6">
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-gray-200">
        <router-link to="/settings" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          General
        </router-link>
        <router-link to="/settings/webhooks" class="px-4 py-2 text-sm font-medium border-b-2 border-primary-500 text-primary-600">
          Webhooks
        </router-link>
        <router-link to="/settings/users" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Users
        </router-link>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-500">Manage webhook endpoints for event notifications.</p>
        <button class="btn-primary" @click="openCreateModal">Add Webhook</button>
      </div>

      <!-- Webhook list -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="card">
          <div class="skeleton h-5 w-1/3 rounded mb-2" />
          <div class="skeleton h-3 w-2/3 rounded" />
        </div>
      </div>

      <div v-else-if="webhooks.length > 0" class="space-y-3">
        <div v-for="webhook in webhooks" :key="webhook.id" class="card">
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  :class="[
                    'h-2 w-2 rounded-full',
                    webhook.is_active ? 'bg-success-500' : 'bg-gray-300',
                  ]"
                />
                <p class="text-sm font-medium text-gray-900 truncate">{{ webhook.url }}</p>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="event in webhook.events"
                  :key="event"
                  class="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {{ event }}
                </span>
              </div>
              <p class="mt-2 text-xs text-gray-400">Created {{ new Date(webhook.created_at).toLocaleDateString() }}</p>
            </div>
            <div class="flex items-center gap-2 ml-4">
              <button
                class="btn-secondary btn-sm"
                @click="toggleActive(webhook)"
              >
                {{ webhook.is_active ? 'Disable' : 'Enable' }}
              </button>
              <button
                class="btn-danger btn-sm"
                @click="deleteWebhook(webhook.id)"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="card text-center py-8">
        <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p class="mt-2 text-sm text-gray-500">No webhooks configured.</p>
        <button class="btn-primary mt-4" @click="openCreateModal">Add your first webhook</button>
      </div>

      <!-- Create modal -->
      <Modal :open="showCreateModal" title="Add Webhook" size="md" @close="showCreateModal = false">
        <form @submit.prevent="onSubmit" class="space-y-4">
          <div>
            <label class="label">URL</label>
            <input v-model="url" type="url" class="input" :class="{ 'input-error': errors.url }" placeholder="https://your-api.com/webhook" />
            <p v-if="errors.url" class="mt-1 text-xs text-danger-500">{{ errors.url }}</p>
          </div>

          <div>
            <label class="label">Events</label>
            <p v-if="errors.events" class="mb-1 text-xs text-danger-500">{{ errors.events }}</p>
            <div class="space-y-2">
              <label v-for="event in eventOptions" :key="event" class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="events?.includes(event)"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  @change="toggleEvent(event)"
                />
                <span class="text-sm text-gray-700">{{ event }}</span>
              </label>
            </div>
          </div>

          <label class="flex items-center gap-2">
            <input v-model="is_active" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span class="text-sm text-gray-700">Active</span>
          </label>
        </form>

        <template #footer>
          <button class="btn-secondary" @click="showCreateModal = false">Cancel</button>
          <button class="btn-primary" :disabled="creating" @click="onSubmit">
            {{ creating ? 'Creating...' : 'Create Webhook' }}
          </button>
        </template>
      </Modal>
    </div>
  </AppLayout>
</template>
