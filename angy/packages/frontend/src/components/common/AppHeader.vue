<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import { useNotificationStore } from '@/stores/notification.store';

defineEmits<{ 'toggle-sidebar': [] }>();

const route = useRoute();
const notifications = useNotificationStore();

const breadcrumb = computed(() => (route.meta.breadcrumb as string) || '');

// WS status is injected from parent via provide/inject or props.
// For simplicity, we show a static dot that can be bound to ws status.
defineProps<{ wsStatus?: 'connected' | 'reconnecting' | 'disconnected' }>();

const statusColor = computed(() => {
  // No wsStatus prop passed = default disconnected
  return 'bg-gray-400';
});
</script>

<template>
  <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
    <div class="flex items-center space-x-4">
      <button class="lg:hidden p-1 text-slate-500 hover:text-slate-700" @click="$emit('toggle-sidebar')">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <h1 class="text-lg font-semibold text-slate-800">{{ breadcrumb }}</h1>
    </div>

    <div class="flex items-center space-x-4">
      <span
        class="w-2.5 h-2.5 rounded-full"
        :class="wsStatus === 'connected' ? 'bg-green-500' : wsStatus === 'reconnecting' ? 'bg-yellow-500' : statusColor"
        :title="wsStatus || 'disconnected'"
      />
      <button class="relative p-2 text-slate-500 hover:text-slate-700">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span
          v-if="notifications.unreadCount > 0"
          class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
        >
          {{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}
        </span>
      </button>
    </div>
  </header>
</template>
