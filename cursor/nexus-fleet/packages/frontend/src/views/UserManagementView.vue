<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { USER_ROLES } from '@nexus-fleet/shared'
import type { User, CreateUserInput } from '@nexus-fleet/shared'
import type { ColumnDef } from '../components/common/DataTable.vue'
import AppLayout from '../layouts/AppLayout.vue'
import DataTable from '../components/common/DataTable.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import Modal from '../components/common/Modal.vue'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const api = useApi()
const toast = useToast()

const users = ref<User[]>([])
const loading = ref(true)
const inviteModalOpen = ref(false)
const deactivateDialogOpen = ref(false)
const selectedUser = ref<User | null>(null)
const saving = ref(false)

const inviteForm = ref({
  email: '',
  name: '',
  password: '',
  role: 'viewer' as typeof USER_ROLES[number],
})

const columns: ColumnDef<User>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'updatedAt', label: 'Last Active', render: (row) => new Date(row.updatedAt).toLocaleDateString() },
  { key: 'actions', label: '' },
]

async function fetchUsers() {
  loading.value = true
  try {
    const { data: res } = await api.get('/users')
    users.value = res.data
  } catch {
    toast.error('Failed to load users')
  } finally {
    loading.value = false
  }
}

function openInviteModal() {
  inviteForm.value = { email: '', name: '', password: '', role: 'viewer' }
  inviteModalOpen.value = true
}

async function handleInvite() {
  if (!inviteForm.value.email || !inviteForm.value.name || !inviteForm.value.password) {
    toast.error('All fields are required')
    return
  }
  saving.value = true
  try {
    const { data: res } = await api.post('/users', inviteForm.value)
    users.value.unshift(res.data)
    inviteModalOpen.value = false
    toast.success('User invited successfully')
  } catch {
    toast.error('Failed to invite user')
  } finally {
    saving.value = false
  }
}

function confirmDeactivate(user: User) {
  selectedUser.value = user
  deactivateDialogOpen.value = true
}

async function handleDeactivate() {
  if (!selectedUser.value) return
  try {
    await api.delete(`/users/${selectedUser.value.id}`)
    users.value = users.value.filter(u => u.id !== selectedUser.value!.id)
    toast.success('User deactivated')
  } catch {
    toast.error('Failed to deactivate user')
  } finally {
    deactivateDialogOpen.value = false
    selectedUser.value = null
  }
}

async function changeRole(user: User, role: string) {
  try {
    const { data: res } = await api.patch(`/users/${user.id}`, { role })
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx !== -1) users.value[idx] = res.data
    toast.success('Role updated')
  } catch {
    toast.error('Failed to update role')
  }
}

onMounted(fetchUsers)
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">User Management</h1>
          <p class="mt-1 text-sm text-slate-500">
            Manage team members and their roles
          </p>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          @click="openInviteModal"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
          Invite User
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Data Table -->
      <DataTable
        v-else
        :columns="columns"
        :data="users"
        :total-items="users.length"
        :page="1"
        :page-size="100"
      >
        <template #cell-name="{ row }">
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {{ row.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) }}
            </div>
            <span class="font-medium text-slate-900">{{ row.name }}</span>
          </div>
        </template>

        <template #cell-role="{ row }">
          <select
            :value="row.role"
            class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            @change="changeRole(row, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="r in USER_ROLES" :key="r" :value="r">
              {{ r.charAt(0).toUpperCase() + r.slice(1) }}
            </option>
          </select>
        </template>

        <template #cell-status>
          <StatusBadge status="active" />
        </template>

        <template #cell-actions="{ row }">
          <button
            class="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            @click.stop="confirmDeactivate(row)"
          >
            Deactivate
          </button>
        </template>
      </DataTable>
    </div>

    <!-- Invite Modal -->
    <Modal :is-open="inviteModalOpen" title="Invite User" size="md" @close="inviteModalOpen = false">
      <form class="space-y-4" @submit.prevent="handleInvite">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
          <input
            v-model="inviteForm.name"
            type="text"
            placeholder="John Doe"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Email *</label>
          <input
            v-model="inviteForm.email"
            type="email"
            placeholder="john@example.com"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Password *</label>
          <input
            v-model="inviteForm.password"
            type="password"
            placeholder="Minimum 8 characters"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Role</label>
          <select
            v-model="inviteForm.role"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option v-for="r in USER_ROLES" :key="r" :value="r">
              {{ r.charAt(0).toUpperCase() + r.slice(1) }}
            </option>
          </select>
        </div>
      </form>
      <template #footer>
        <button
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          @click="inviteModalOpen = false"
        >
          Cancel
        </button>
        <button
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="saving"
          @click="handleInvite"
        >
          Send Invite
        </button>
      </template>
    </Modal>

    <!-- Deactivate Dialog -->
    <ConfirmDialog
      :is-open="deactivateDialogOpen"
      title="Deactivate User"
      :message="`Are you sure you want to deactivate ${selectedUser?.name ?? 'this user'}? They will lose access to the platform.`"
      confirm-text="Deactivate"
      variant="danger"
      @confirm="handleDeactivate"
      @cancel="deactivateDialogOpen = false"
    />
  </AppLayout>
</template>
