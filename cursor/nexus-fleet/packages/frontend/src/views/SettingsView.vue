<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import type { Tenant } from '@nexus-fleet/shared'
import AppLayout from '../layouts/AppLayout.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const api = useApi()
const toast = useToast()

const activeTab = ref('general')
const tenant = ref<Tenant | null>(null)
const loading = ref(true)
const saving = ref(false)
const tenantName = ref('')

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'users', label: 'Users', route: '/settings/users' },
  { id: 'webhooks', label: 'Webhooks', route: '/settings/webhooks' },
]

const planBadgeClass = computed(() => {
  const classes: Record<string, string> = {
    free: 'bg-slate-100 text-slate-700',
    pro: 'bg-primary-50 text-primary-700',
    enterprise: 'bg-amber-50 text-amber-700',
  }
  return classes[tenant.value?.plan ?? 'free'] ?? classes.free
})

function handleTabClick(tab: typeof tabs[0]) {
  if (tab.route) {
    router.push(tab.route)
  } else {
    activeTab.value = tab.id
  }
}

async function saveTenantSettings() {
  if (!tenantName.value.trim()) {
    toast.error('Tenant name is required')
    return
  }
  saving.value = true
  try {
    const { data: res } = await api.patch(`/tenants/${tenant.value!.id}`, { name: tenantName.value })
    tenant.value = res.data
    toast.success('Settings saved')
  } catch {
    toast.error('Failed to save settings')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const { data: res } = await api.get('/tenants/current')
    tenant.value = res.data
    tenantName.value = res.data.name
  } catch {
    toast.error('Failed to load settings')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Settings</h1>
        <p class="mt-1 text-sm text-slate-500">Manage your organization settings</p>
      </div>

      <!-- Tabs -->
      <div class="border-b border-slate-200">
        <nav class="-mb-px flex gap-6">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="[
              'border-b-2 pb-3 text-sm font-medium transition-colors',
              activeTab === tab.id && !tab.route
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            ]"
            @click="handleTabClick(tab)"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <!-- General Tab -->
      <div v-else-if="activeTab === 'general' && tenant" class="max-w-2xl space-y-6">
        <!-- Organization Card -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold text-slate-900">Organization</h2>
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Organization Name</label>
              <input
                v-model="tenantName"
                type="text"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Slug</label>
              <input
                :value="tenant.slug"
                type="text"
                disabled
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
              <p class="mt-1 text-xs text-slate-400">Organization slug cannot be changed</p>
            </div>
          </div>
        </div>

        <!-- Plan Card -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold text-slate-900">Plan</h2>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span :class="['rounded-full px-3 py-1 text-sm font-semibold capitalize', planBadgeClass]">
                {{ tenant.plan }}
              </span>
              <span class="text-sm text-slate-500">Current plan</span>
            </div>
          </div>
          <dl class="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Created</dt>
              <dd class="mt-1 text-sm text-slate-700">{{ new Date(tenant.createdAt).toLocaleDateString() }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wider text-slate-400">Tenant ID</dt>
              <dd class="mt-1 text-xs font-mono text-slate-500">{{ tenant.id }}</dd>
            </div>
          </dl>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end">
          <button
            class="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            :disabled="saving"
            @click="saveTenantSettings"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
