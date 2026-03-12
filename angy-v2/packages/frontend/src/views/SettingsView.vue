<script setup lang="ts">
import { Settings, Bell, Shield } from 'lucide-vue-next';
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">Settings</h1>
      <p class="text-sm text-neutral-400 mt-1">Manage your application preferences and configuration</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink to="/settings/webhooks" class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 hover:border-primary-200 hover:shadow transition-all duration-150 group">
        <div class="w-10 h-10 rounded-xl bg-accent-50 text-accent-500 flex items-center justify-center mb-3">
          <Bell class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-medium text-neutral-800 group-hover:text-primary-600 transition-colors">Webhooks</h3>
        <p class="text-sm text-neutral-400 mt-1">Configure webhook endpoints and event subscriptions</p>
      </RouterLink>

      <RouterLink to="/settings/users" class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 hover:border-primary-200 hover:shadow transition-all duration-150 group">
        <div class="w-10 h-10 rounded-xl bg-primary-50 text-primary-500 flex items-center justify-center mb-3">
          <Shield class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-medium text-neutral-800 group-hover:text-primary-600 transition-colors">User Management</h3>
        <p class="text-sm text-neutral-400 mt-1">Manage user accounts, roles, and permissions</p>
      </RouterLink>

      <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
        <div class="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3">
          <Settings class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-medium text-neutral-800">General</h3>
        <p class="text-sm text-neutral-400 mt-1">General application settings and preferences</p>
      </div>
    </div>
  </div>
</template>
