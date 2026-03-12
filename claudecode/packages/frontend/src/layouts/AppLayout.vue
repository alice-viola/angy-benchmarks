<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();

const sidebarCollapsed = ref(false);
const sidebarMobileOpen = ref(false);
const userDropdownOpen = ref(false);

const pageTitle = computed(() => (route.meta.title as string) || 'NexusFleet');

const navItems = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    label: 'Shipments',
    to: '/shipments',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    label: 'Vehicles',
    to: '/vehicles',
    icon: 'M8 17h8M8 17v-4m8 4v-4m-8 0h8m-8 0V9m8 4V9m0 0H8m8 0l-1.5-4h-5L8 9',
  },
  {
    label: 'Drivers',
    to: '/drivers',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    label: 'Routes',
    to: '/routes',
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  },
  {
    label: 'Geofences',
    to: '/geofences',
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

function isActive(to: string): boolean {
  if (to === '/dashboard') return route.path === '/dashboard';
  return route.path.startsWith(to);
}

function handleResize() {
  if (window.innerWidth >= 1024) {
    sidebarMobileOpen.value = false;
  }
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
  notificationsStore.fetchNotifications();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarMobileOpen"
      class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      @click="sidebarMobileOpen = false"
    />

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar-bg transition-all duration-300 lg:static',
        sidebarCollapsed ? 'w-16' : 'w-64',
        sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <!-- Logo -->
      <div class="flex h-16 items-center justify-between px-4">
        <div v-if="!sidebarCollapsed" class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span class="text-lg font-bold text-white">NexusFleet</span>
        </div>
        <button
          class="hidden lg:block p-1 text-sidebar-text hover:text-white rounded"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path v-if="sidebarCollapsed" stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="['sidebar-link', isActive(item.to) && 'active']"
          :title="sidebarCollapsed ? item.label : undefined"
          @click="sidebarMobileOpen = false"
        >
          <svg class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
          </svg>
          <span v-if="!sidebarCollapsed">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- User section -->
      <div v-if="authStore.user" class="border-t border-white/10 p-4">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {{ authStore.user.first_name[0] }}{{ authStore.user.last_name[0] }}
          </div>
          <div v-if="!sidebarCollapsed" class="min-w-0">
            <p class="truncate text-sm font-medium text-white">
              {{ authStore.user.first_name }} {{ authStore.user.last_name }}
            </p>
            <p class="truncate text-xs text-sidebar-text">{{ authStore.user.email }}</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Top header -->
      <header class="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
        <div class="flex items-center gap-4">
          <!-- Mobile hamburger -->
          <button
            class="p-1 text-gray-500 hover:text-gray-700 lg:hidden"
            @click="sidebarMobileOpen = true"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 class="text-lg font-semibold text-gray-900">{{ pageTitle }}</h1>
        </div>

        <div class="flex items-center gap-3">
          <!-- Notification bell -->
          <RouterLink
            to="/dashboard"
            class="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span
              v-if="notificationsStore.unreadCount > 0"
              class="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs text-white font-medium"
            >
              {{ notificationsStore.unreadCount > 9 ? '9+' : notificationsStore.unreadCount }}
            </span>
          </RouterLink>

          <!-- User dropdown -->
          <div class="relative">
            <button
              class="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100"
              @click="userDropdownOpen = !userDropdownOpen"
            >
              <div class="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                {{ authStore.user?.first_name?.[0] }}{{ authStore.user?.last_name?.[0] }}
              </div>
              <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              v-if="userDropdownOpen"
              class="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50"
              @click="userDropdownOpen = false"
            >
              <RouterLink
                to="/settings"
                class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Settings
              </RouterLink>
              <button
                class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                @click="handleLogout"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto bg-surface p-4 lg:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
