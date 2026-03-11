<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useWebSocket, type WsStatus } from '../composables/useWebSocket';
import Breadcrumbs from '../components/common/Breadcrumbs.vue';
import Toast from '../components/common/Toast.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const sidebarCollapsed = ref(false);
const mobileMenuOpen = ref(false);
const userDropdownOpen = ref(false);
const isMobile = ref(false);

const wsBaseUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws';
const { status: wsStatus } = useWebSocket(wsBaseUrl, { autoConnect: true });

const connectionColor = computed(() => {
  const map: Record<WsStatus, string> = {
    connected: 'bg-success-500',
    reconnecting: 'bg-accent-500',
    disconnected: 'bg-danger-500',
  };
  return map[wsStatus.value];
});

const connectionLabel = computed(() => {
  const map: Record<WsStatus, string> = {
    connected: 'Connected',
    reconnecting: 'Reconnecting…',
    disconnected: 'Disconnected',
  };
  return map[wsStatus.value];
});

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { label: 'Shipments', to: '/shipments', icon: 'shipments' },
  { label: 'Vehicles', to: '/vehicles', icon: 'vehicles' },
  { label: 'Drivers', to: '/drivers', icon: 'drivers' },
  { label: 'Routes', to: '/routes', icon: 'routes' },
  { label: 'Geofences', to: '/geofences', icon: 'geofences' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
];

const breadcrumbItems = computed(() => {
  const items: { label: string; to?: string }[] = [];
  for (const matched of route.matched) {
    if (matched.name) {
      items.push({
        label: String(matched.name).replace(/([A-Z])/g, ' $1').trim(),
        to: matched.path === route.path ? undefined : matched.path,
      });
    }
  }
  return items.length ? items : [{ label: 'Dashboard' }];
});

const userInitials = computed(() => {
  const u = authStore.user;
  if (!u) return '?';
  const first = u.firstName?.[0] ?? '';
  const last = u.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || u.email[0].toUpperCase();
});

const userName = computed(() => {
  const u = authStore.user;
  if (!u) return 'User';
  if (u.firstName) return `${u.firstName} ${u.lastName ?? ''}`.trim();
  return u.email;
});

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/');
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileMenuOpen.value = !mobileMenuOpen.value;
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function checkMobile() {
  isMobile.value = window.innerWidth < 1024;
  if (!isMobile.value) mobileMenuOpen.value = false;
}

function closeUserDropdown(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('[data-user-dropdown]')) {
    userDropdownOpen.value = false;
  }
}

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  document.addEventListener('click', closeUserDropdown);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  document.removeEventListener('click', closeUserDropdown);
});
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-surface-light">
    <!-- Mobile overlay -->
    <Transition name="fade">
      <div
        v-if="mobileMenuOpen && isMobile"
        class="fixed inset-0 z-30 bg-black/50 lg:hidden"
        @click="mobileMenuOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar-bg text-sidebar-text transition-all duration-300 ease-in-out',
        isMobile
          ? mobileMenuOpen ? 'w-64 translate-x-0' : '-translate-x-full w-64'
          : sidebarCollapsed ? 'w-16' : 'w-64',
        'lg:relative lg:translate-x-0',
      ]"
    >
      <!-- Logo -->
      <div class="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-sm">
          NF
        </div>
        <Transition name="fade">
          <span
            v-if="!sidebarCollapsed || isMobile"
            class="text-lg font-semibold text-white whitespace-nowrap"
          >
            NexusFleet
          </span>
        </Transition>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
            isActive(item.to)
              ? 'bg-primary-600/20 text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-white',
          ]"
          @click="isMobile && (mobileMenuOpen = false)"
        >
          <!-- Icons -->
          <svg
            v-if="item.icon === 'dashboard'"
            class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <svg
            v-else-if="item.icon === 'shipments'"
            class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <svg
            v-else-if="item.icon === 'vehicles'"
            class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h.008M3.375 14.25H6.75m-3.375 0V6.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v3.75m3.75 4.125v-2.625c0-.621-.36-1.188-.919-1.453l-2.456-1.164A1.125 1.125 0 0014.25 9.75h-1.5" />
          </svg>
          <svg
            v-else-if="item.icon === 'drivers'"
            class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <svg
            v-else-if="item.icon === 'routes'"
            class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          <svg
            v-else-if="item.icon === 'geofences'"
            class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          <svg
            v-else-if="item.icon === 'settings'"
            class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>

          <Transition name="fade">
            <span v-if="!sidebarCollapsed || isMobile" class="whitespace-nowrap">
              {{ item.label }}
            </span>
          </Transition>
        </RouterLink>
      </nav>

      <!-- User section at bottom -->
      <div class="border-t border-white/10 p-3">
        <div
          :class="[
            'flex items-center gap-3 rounded-lg px-3 py-2',
            sidebarCollapsed && !isMobile ? 'justify-center' : '',
          ]"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
            {{ userInitials }}
          </div>
          <Transition name="fade">
            <div v-if="!sidebarCollapsed || isMobile" class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-white">{{ userName }}</p>
              <p class="truncate text-xs text-slate-400">{{ authStore.user?.role ?? '' }}</p>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Collapse toggle (desktop only) -->
      <button
        v-if="!isMobile"
        class="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:bg-slate-50 transition-colors"
        @click="toggleSidebar"
      >
        <svg
          class="h-3.5 w-3.5 transition-transform duration-300"
          :class="{ 'rotate-180': sidebarCollapsed }"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
    </aside>

    <!-- Main content area -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Header -->
      <header class="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
        <div class="flex items-center gap-4">
          <!-- Mobile hamburger -->
          <button
            class="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            @click="toggleSidebar"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <Breadcrumbs :items="breadcrumbItems" />
        </div>

        <div class="flex items-center gap-3">
          <!-- Connection status -->
          <div class="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            <span :class="['h-2 w-2 rounded-full', connectionColor]" />
            <span class="hidden text-xs font-medium text-slate-600 sm:inline">{{ connectionLabel }}</span>
          </div>

          <!-- Notification bell -->
          <button class="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition-colors">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500" />
          </button>

          <!-- User dropdown -->
          <div class="relative" data-user-dropdown>
            <button
              class="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              @click.stop="userDropdownOpen = !userDropdownOpen"
            >
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
                {{ userInitials }}
              </div>
              <svg class="hidden h-4 w-4 text-slate-400 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <div
                v-if="userDropdownOpen"
                class="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
              >
                <div class="border-b border-slate-100 px-4 py-3">
                  <p class="text-sm font-medium text-slate-900">{{ userName }}</p>
                  <p class="text-xs text-slate-500">{{ authStore.user?.email }}</p>
                </div>
                <RouterLink
                  to="/settings"
                  class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  @click="userDropdownOpen = false"
                >
                  <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </RouterLink>
                <button
                  class="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                  @click="handleLogout"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Sign out
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <slot />
      </main>
    </div>

    <!-- Toast container -->
    <Toast />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
