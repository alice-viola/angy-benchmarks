<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';
import AppLayout from '@/layouts/AppLayout.vue';
import type { Tenant } from '@/types';

const api = useApi();
const authStore = useAuthStore();

const tenant = ref<Tenant | null>(null);
const loading = ref(true);
const saving = ref(false);
const tenantName = ref('');
const successMessage = ref('');

async function fetchTenant() {
  loading.value = true;
  try {
    const response = await api.get<Tenant>('/tenant');
    if (response.success) {
      tenant.value = response.data;
      tenantName.value = response.data.name;
    }
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  successMessage.value = '';
  try {
    const response = await api.put<Tenant>('/tenant', { name: tenantName.value });
    if (response.success) {
      tenant.value = response.data;
      successMessage.value = 'Settings saved successfully.';
      setTimeout(() => { successMessage.value = ''; }, 3000);
    }
  } finally {
    saving.value = false;
  }
}

onMounted(fetchTenant);
</script>

<template>
  <AppLayout>
    <div class="max-w-2xl space-y-6">
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
      </div>

      <!-- Navigation tabs -->
      <div class="flex gap-1 border-b border-gray-200">
        <router-link to="/settings" class="px-4 py-2 text-sm font-medium border-b-2 border-primary-500 text-primary-600">
          General
        </router-link>
        <router-link to="/settings/webhooks" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Webhooks
        </router-link>
        <router-link to="/settings/users" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Users
        </router-link>
      </div>

      <div v-if="successMessage" class="rounded-lg bg-success-50 border border-success-200 p-3 text-sm text-success-700">
        {{ successMessage }}
      </div>

      <div class="card">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Organization</h3>

        <div v-if="loading" class="space-y-3">
          <div class="skeleton h-4 w-1/4 rounded" />
          <div class="skeleton h-10 w-full rounded" />
        </div>

        <form v-else @submit.prevent="handleSave" class="space-y-4">
          <div>
            <label class="label">Organization Name</label>
            <input v-model="tenantName" type="text" class="input" placeholder="Organization name" />
          </div>

          <div v-if="tenant">
            <label class="label">Plan</label>
            <div class="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700 capitalize">
              {{ tenant.plan }}
            </div>
          </div>

          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </form>
      </div>
    </div>
  </AppLayout>
</template>
