<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { WEBHOOK_EVENTS } from '@nexus-fleet/shared'
import type { Webhook } from '@nexus-fleet/shared'
import AppLayout from '../layouts/AppLayout.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import Modal from '../components/common/Modal.vue'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const api = useApi()
const toast = useToast()

const webhooks = ref<Webhook[]>([])
const loading = ref(true)
const addModalOpen = ref(false)
const editModalOpen = ref(false)
const deleteDialogOpen = ref(false)
const selectedWebhook = ref<Webhook | null>(null)
const saving = ref(false)
const testing = ref<string | null>(null)

const formUrl = ref('')
const formEvents = ref<string[]>([])
const formIsActive = ref(true)

async function fetchWebhooks() {
  loading.value = true
  try {
    const { data: res } = await api.get('/webhooks')
    webhooks.value = res.data
  } catch {
    toast.error('Failed to load webhooks')
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  formUrl.value = ''
  formEvents.value = []
  formIsActive.value = true
  addModalOpen.value = true
}

function openEditModal(webhook: Webhook) {
  selectedWebhook.value = webhook
  formUrl.value = webhook.url
  formEvents.value = [...webhook.events]
  formIsActive.value = webhook.isActive
  editModalOpen.value = true
}

function confirmDelete(webhook: Webhook) {
  selectedWebhook.value = webhook
  deleteDialogOpen.value = true
}

function toggleEvent(event: string) {
  const idx = formEvents.value.indexOf(event)
  if (idx >= 0) {
    formEvents.value.splice(idx, 1)
  } else {
    formEvents.value.push(event)
  }
}

async function handleAdd() {
  if (!formUrl.value || formEvents.value.length === 0) {
    toast.error('URL and at least one event are required')
    return
  }
  saving.value = true
  try {
    const { data: res } = await api.post('/webhooks', {
      url: formUrl.value,
      events: formEvents.value,
      isActive: formIsActive.value,
    })
    webhooks.value.unshift(res.data)
    addModalOpen.value = false
    toast.success('Webhook endpoint added')
  } catch {
    toast.error('Failed to add webhook')
  } finally {
    saving.value = false
  }
}

async function handleUpdate() {
  if (!selectedWebhook.value || !formUrl.value || formEvents.value.length === 0) {
    toast.error('URL and at least one event are required')
    return
  }
  saving.value = true
  try {
    const { data: res } = await api.patch(`/webhooks/${selectedWebhook.value.id}`, {
      url: formUrl.value,
      events: formEvents.value,
      isActive: formIsActive.value,
    })
    const idx = webhooks.value.findIndex(w => w.id === selectedWebhook.value!.id)
    if (idx !== -1) webhooks.value[idx] = res.data
    editModalOpen.value = false
    toast.success('Webhook updated')
  } catch {
    toast.error('Failed to update webhook')
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!selectedWebhook.value) return
  try {
    await api.delete(`/webhooks/${selectedWebhook.value.id}`)
    webhooks.value = webhooks.value.filter(w => w.id !== selectedWebhook.value!.id)
    toast.success('Webhook deleted')
  } catch {
    toast.error('Failed to delete webhook')
  } finally {
    deleteDialogOpen.value = false
    selectedWebhook.value = null
  }
}

async function testWebhook(webhook: Webhook) {
  testing.value = webhook.id
  try {
    await api.post(`/webhooks/${webhook.id}/test`)
    toast.success('Test payload sent successfully')
  } catch {
    toast.error('Webhook test failed')
  } finally {
    testing.value = null
  }
}

function formatEvent(event: string): string {
  return event.replace(/\./g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

onMounted(fetchWebhooks)
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Webhook Endpoints</h1>
          <p class="mt-1 text-sm text-slate-500">
            Configure endpoints to receive real-time event notifications
          </p>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          @click="openAddModal"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Endpoint
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Empty State -->
      <div v-else-if="webhooks.length === 0" class="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
        <svg class="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        <h3 class="mt-3 text-sm font-semibold text-slate-900">No webhook endpoints</h3>
        <p class="mt-1 text-sm text-slate-500">Add an endpoint to start receiving event notifications.</p>
      </div>

      <!-- Webhook List -->
      <div v-else class="space-y-4">
        <div
          v-for="webhook in webhooks"
          :key="webhook.id"
          class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3">
                <StatusBadge :status="webhook.isActive ? 'active' : 'inactive'" />
                <code class="truncate text-sm font-medium text-slate-900">{{ webhook.url }}</code>
              </div>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <span
                  v-for="event in webhook.events"
                  :key="event"
                  class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                >
                  {{ formatEvent(event) }}
                </span>
              </div>
              <p class="mt-2 text-xs text-slate-400">
                Created {{ new Date(webhook.createdAt).toLocaleDateString() }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                :disabled="testing === webhook.id"
                @click="testWebhook(webhook)"
              >
                <LoadingSpinner v-if="testing === webhook.id" size="sm" />
                <svg v-else class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                Test
              </button>
              <button
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                @click="openEditModal(webhook)"
              >
                Edit
              </button>
              <button
                class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                @click="confirmDelete(webhook)"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Webhook Modal -->
    <Modal :is-open="addModalOpen" title="Add Webhook Endpoint" size="lg" @close="addModalOpen = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Endpoint URL *</label>
          <input
            v-model="formUrl"
            type="url"
            placeholder="https://example.com/webhooks"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">Events *</label>
          <div class="space-y-2">
            <label
              v-for="event in WEBHOOK_EVENTS"
              :key="event"
              class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer transition-colors hover:bg-slate-50"
              :class="formEvents.includes(event) ? 'border-primary-300 bg-primary-50/30' : ''"
            >
              <input
                type="checkbox"
                :checked="formEvents.includes(event)"
                class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                @change="toggleEvent(event)"
              />
              <div>
                <p class="text-sm font-medium text-slate-700">{{ formatEvent(event) }}</p>
                <p class="text-xs text-slate-400">{{ event }}</p>
              </div>
            </label>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <label class="relative inline-flex cursor-pointer items-center">
            <input v-model="formIsActive" type="checkbox" class="peer sr-only" />
            <div class="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
          </label>
          <span class="text-sm font-medium text-slate-700">Active</span>
        </div>
      </div>
      <template #footer>
        <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" @click="addModalOpen = false">
          Cancel
        </button>
        <button
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="saving || !formUrl || formEvents.length === 0"
          @click="handleAdd"
        >
          Add Endpoint
        </button>
      </template>
    </Modal>

    <!-- Edit Webhook Modal -->
    <Modal :is-open="editModalOpen" title="Edit Webhook Endpoint" size="lg" @close="editModalOpen = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Endpoint URL *</label>
          <input
            v-model="formUrl"
            type="url"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">Events *</label>
          <div class="space-y-2">
            <label
              v-for="event in WEBHOOK_EVENTS"
              :key="event"
              class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer transition-colors hover:bg-slate-50"
              :class="formEvents.includes(event) ? 'border-primary-300 bg-primary-50/30' : ''"
            >
              <input
                type="checkbox"
                :checked="formEvents.includes(event)"
                class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                @change="toggleEvent(event)"
              />
              <div>
                <p class="text-sm font-medium text-slate-700">{{ formatEvent(event) }}</p>
                <p class="text-xs text-slate-400">{{ event }}</p>
              </div>
            </label>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <label class="relative inline-flex cursor-pointer items-center">
            <input v-model="formIsActive" type="checkbox" class="peer sr-only" />
            <div class="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
          </label>
          <span class="text-sm font-medium text-slate-700">Active</span>
        </div>
      </div>
      <template #footer>
        <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" @click="editModalOpen = false">
          Cancel
        </button>
        <button
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="saving || !formUrl || formEvents.length === 0"
          @click="handleUpdate"
        >
          Save Changes
        </button>
      </template>
    </Modal>

    <!-- Delete Dialog -->
    <ConfirmDialog
      :is-open="deleteDialogOpen"
      title="Delete Webhook"
      :message="`Are you sure you want to delete the webhook for ${selectedWebhook?.url ?? 'this endpoint'}? This action cannot be undone.`"
      confirm-text="Delete"
      variant="danger"
      @confirm="handleDelete"
      @cancel="deleteDialogOpen = false"
    />
  </AppLayout>
</template>
