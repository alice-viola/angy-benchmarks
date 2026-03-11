<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { useToastStore } from '@/stores/toast.store';
import { api } from '@/plugins/axios';

const auth = useAuthStore();
const toast = useToastStore();
const tenantName = ref(auth.tenant?.name ?? '');
const saving = ref(false);

onMounted(() => {
  tenantName.value = auth.tenant?.name ?? '';
});

async function saveName() {
  saving.value = true;
  try {
    await api.patch('/api/v1/tenants/current', { name: tenantName.value });
    if (auth.tenant) auth.tenant.name = tenantName.value;
    toast.show('Settings updated', 'success');
  } catch {
    toast.show('Failed to update settings', 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Settings</h1>
    <div class="max-w-lg space-y-6">
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">Tenant Name</h3>
        <div class="flex gap-3">
          <input v-model="tenantName" type="text"
            class="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button :disabled="saving" @click="saveName"
            class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">Plan</h3>
        <p class="text-lg font-semibold text-slate-900 capitalize">{{ auth.tenant?.plan ?? 'Free' }}</p>
      </div>
    </div>
  </div>
</template>
