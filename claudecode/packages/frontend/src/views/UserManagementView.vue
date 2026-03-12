<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { userCreateSchema, USER_ROLES } from '@nexus-fleet/shared';
import { useApi } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';
import AppLayout from '@/layouts/AppLayout.vue';
import Modal from '@/components/common/Modal.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { User } from '@/types';

const api = useApi();
const authStore = useAuthStore();

const users = ref<User[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const creating = ref(false);

const schema = toTypedSchema(userCreateSchema);
const { handleSubmit, errors, resetForm } = useForm({ validationSchema: schema });
const { value: email } = useField<string>('email');
const { value: password } = useField<string>('password');
const { value: role } = useField<string>('role');
const { value: first_name } = useField<string>('first_name');
const { value: last_name } = useField<string>('last_name');

const canManageUsers = ref(false);

async function fetchUsers() {
  loading.value = true;
  try {
    const response = await api.get<User[]>('/users');
    if (response.success) {
      users.value = response.data;
    }
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  resetForm({
    values: { email: '', password: '', role: 'viewer', first_name: '', last_name: '' },
  });
  showCreateModal.value = true;
}

const onSubmit = handleSubmit(async (values) => {
  creating.value = true;
  try {
    const response = await api.post<User>('/users', values);
    if (response.success) {
      users.value.unshift(response.data);
      showCreateModal.value = false;
    }
  } finally {
    creating.value = false;
  }
});

async function deleteUser(id: string) {
  if (id === authStore.user?.id) return;
  const response = await api.del(`/users/${id}`);
  if (response.success) {
    users.value = users.value.filter((u) => u.id !== id);
  }
}

onMounted(() => {
  const currentRole = authStore.user?.role;
  canManageUsers.value = currentRole === 'owner' || currentRole === 'admin';
  fetchUsers();
});
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
        <router-link to="/settings/webhooks" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Webhooks
        </router-link>
        <router-link to="/settings/users" class="px-4 py-2 text-sm font-medium border-b-2 border-primary-500 text-primary-600">
          Users
        </router-link>
      </div>

      <div v-if="!canManageUsers" class="card text-center py-8">
        <p class="text-sm text-gray-500">You do not have permission to manage users.</p>
      </div>

      <template v-else>
        <div class="flex items-center justify-between">
          <p class="text-sm text-gray-500">Manage team members and their roles.</p>
          <button class="btn-primary" @click="openCreateModal">Invite User</button>
        </div>

        <!-- User list -->
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="card flex items-center gap-4">
            <div class="skeleton h-10 w-10 rounded-full" />
            <div class="flex-1 space-y-1">
              <div class="skeleton h-4 w-1/4 rounded" />
              <div class="skeleton h-3 w-1/3 rounded" />
            </div>
          </div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="user in users"
            :key="user.id"
            class="card flex items-center gap-4 !py-4"
          >
            <div class="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
              {{ user.first_name[0] }}{{ user.last_name[0] }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900">
                {{ user.first_name }} {{ user.last_name }}
                <span v-if="user.id === authStore.user?.id" class="text-xs text-gray-400">(you)</span>
              </p>
              <p class="text-xs text-gray-500">{{ user.email }}</p>
            </div>
            <StatusBadge :status="user.role" />
            <button
              v-if="user.id !== authStore.user?.id"
              class="text-gray-400 hover:text-danger-500 p-1"
              @click="deleteUser(user.id)"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </template>

      <!-- Create user modal -->
      <Modal :open="showCreateModal" title="Invite User" size="md" @close="showCreateModal = false">
        <form @submit.prevent="onSubmit" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">First Name</label>
              <input v-model="first_name" type="text" class="input" :class="{ 'input-error': errors.first_name }" />
              <p v-if="errors.first_name" class="mt-1 text-xs text-danger-500">{{ errors.first_name }}</p>
            </div>
            <div>
              <label class="label">Last Name</label>
              <input v-model="last_name" type="text" class="input" :class="{ 'input-error': errors.last_name }" />
              <p v-if="errors.last_name" class="mt-1 text-xs text-danger-500">{{ errors.last_name }}</p>
            </div>
          </div>

          <div>
            <label class="label">Email</label>
            <input v-model="email" type="email" class="input" :class="{ 'input-error': errors.email }" placeholder="user@company.com" />
            <p v-if="errors.email" class="mt-1 text-xs text-danger-500">{{ errors.email }}</p>
          </div>

          <div>
            <label class="label">Password</label>
            <input v-model="password" type="password" class="input" :class="{ 'input-error': errors.password }" placeholder="Temporary password" />
            <p v-if="errors.password" class="mt-1 text-xs text-danger-500">{{ errors.password }}</p>
          </div>

          <div>
            <label class="label">Role</label>
            <select v-model="role" class="input" :class="{ 'input-error': errors.role }">
              <option v-for="r in USER_ROLES" :key="r" :value="r">
                {{ r.charAt(0).toUpperCase() + r.slice(1) }}
              </option>
            </select>
            <p v-if="errors.role" class="mt-1 text-xs text-danger-500">{{ errors.role }}</p>
          </div>
        </form>

        <template #footer>
          <button class="btn-secondary" @click="showCreateModal = false">Cancel</button>
          <button class="btn-primary" :disabled="creating" @click="onSubmit">
            {{ creating ? 'Creating...' : 'Create User' }}
          </button>
        </template>
      </Modal>
    </div>
  </AppLayout>
</template>
