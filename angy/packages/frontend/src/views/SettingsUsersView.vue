<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/plugins/axios';
import { useToastStore } from '@/stores/toast.store';
import DataTable from '@/components/common/DataTable.vue';
import type { ColumnDef } from '@/components/common/DataTable.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';

const toast = useToastStore();

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

const users = ref<User[]>([]);
const totalItems = ref(0);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);

// Create dialog
const showCreate = ref(false);
const newEmail = ref('');
const newPassword = ref('');
const newFirst = ref('');
const newLast = ref('');
const newRole = ref('dispatcher');
const createRoles = ['admin', 'dispatcher', 'viewer'];

// Deactivate dialog
const showDeactivate = ref(false);
const deactivateId = ref('');

const columns: ColumnDef<User>[] = [
  { key: 'first_name', label: 'Name', render: (r) => `${r.first_name} ${r.last_name}` },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role', render: (r) => r.role.charAt(0).toUpperCase() + r.role.slice(1) },
  { key: 'is_active', label: 'Active', render: (r) => r.is_active ? 'Yes' : 'No' },
];

onMounted(() => fetchUsers());

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await api.get('/api/v1/users', { params: { page: page.value, limit: pageSize.value } });
    users.value = res.data.data ?? [];
    totalItems.value = res.data.meta?.total ?? users.value.length;
  } catch {
    toast.show('Failed to load users', 'error');
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  try {
    await api.post('/api/v1/users', {
      email: newEmail.value,
      password: newPassword.value,
      first_name: newFirst.value,
      last_name: newLast.value,
      role: newRole.value,
    });
    showCreate.value = false;
    newEmail.value = '';
    newPassword.value = '';
    newFirst.value = '';
    newLast.value = '';
    newRole.value = 'dispatcher';
    toast.show('User created', 'success');
    fetchUsers();
  } catch {
    toast.show('Failed to create user', 'error');
  }
}

async function updateRole(userId: string, role: string) {
  try {
    await api.patch(`/api/v1/users/${userId}`, { role });
    const u = users.value.find(u => u.id === userId);
    if (u) u.role = role;
    toast.show('Role updated', 'success');
  } catch {
    toast.show('Failed to update role', 'error');
  }
}

async function confirmDeactivate() {
  try {
    await api.patch(`/api/v1/users/${deactivateId.value}`, { is_active: false });
    const u = users.value.find(u => u.id === deactivateId.value);
    if (u) u.is_active = false;
    showDeactivate.value = false;
    toast.show('User deactivated', 'success');
  } catch {
    toast.show('Failed to deactivate user', 'error');
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Users</h1>
      <button @click="showCreate = true"
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
        Add User
      </button>
    </div>

    <DataTable :columns="columns" :data="users" :loading="loading"
      :total-items="totalItems" :page="page" :page-size="pageSize"
      @update:page="(p) => { page = p; fetchUsers(); }"
      @update:page-size="(s) => { pageSize = s; page = 1; fetchUsers(); }" />

    <!-- Per-user actions -->
    <div v-if="users.length > 0" class="mt-4 space-y-2">
      <div v-for="u in users" :key="u.id" class="flex items-center gap-3 text-sm">
        <span class="text-slate-600">{{ u.first_name }} {{ u.last_name }}</span>
        <select :value="u.role" @change="updateRole(u.id, ($event.target as HTMLSelectElement).value)"
          class="px-2 py-1 text-xs border border-slate-300 rounded">
          <option v-for="r in createRoles" :key="r" :value="r">{{ r }}</option>
        </select>
        <button v-if="u.is_active && u.role !== 'owner'"
          class="px-2 py-1 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100"
          @click="deactivateId = u.id; showDeactivate = true">Deactivate</button>
      </div>
    </div>

    <!-- Create Dialog -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="showCreate = false" />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h3 class="text-lg font-semibold text-slate-900 mb-4">Add User</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input v-model="newEmail" type="email" class="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input v-model="newPassword" type="password" class="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input v-model="newFirst" type="text" class="w-full px-3 py-2 border border-slate-300 rounded-md" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input v-model="newLast" type="text" class="w-full px-3 py-2 border border-slate-300 rounded-md" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select v-model="newRole" class="w-full px-3 py-2 border border-slate-300 rounded-md">
                <option v-for="r in createRoles" :key="r" :value="r">{{ r.charAt(0).toUpperCase() + r.slice(1) }}</option>
              </select>
            </div>
          </div>
          <div class="mt-6 flex justify-end space-x-3">
            <button class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200" @click="showCreate = false">Cancel</button>
            <button class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              :disabled="!newEmail || !newPassword || !newFirst || !newLast" @click="createUser">Create</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Deactivate Confirm -->
    <ConfirmDialog :open="showDeactivate" title="Deactivate User" message="Are you sure you want to deactivate this user?"
      @confirm="confirmDeactivate" @cancel="showDeactivate = false" />
  </div>
</template>
