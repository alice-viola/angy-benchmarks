<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  Route,
  Radar,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { useNotificationStore } from '../stores/notifications';
import { useTrackingStore } from '../stores/tracking';
import ConnectionStatus from '../components/common/ConnectionStatus.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const trackingStore = useTrackingStore();

const sidebarCollapsed = ref(false);
const mobileMenuOpen = ref(false);
const userDropdownOpen = ref(false);

const pageTitle = computed(() => (route.meta.title as string) || 'Dashboard');

const userInitials = computed(() => {
  const u = authStore.user;
  if (!u) return '?';
  const first = ('first_name' in u ? u.first_name : '') || '';
  const last = ('last_name' in u ? u.last_name : '') || '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
});

const userName = computed(() => {
  const u = authStore.user;
  if (!u) return '';
  const first = ('first_name' in u ? u.first_name : '') || '';
  const last = ('last_name' in u ? u.last_name : '') || '';
  return `${first} ${last}`;
});

const userRole = computed(() => {
  const u = authStore.user;
  return u?.role || '';
});

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  routeName: string;
}

const mainNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', routeName: 'dashboard' },
  { label: 'Shipments', icon: Package, to: '/shipments', routeName: 'shipments' },
  { label: 'Vehicles', icon: Truck, to: '/vehicles', routeName: 'vehicles' },
  { label: 'Drivers', icon: Users, to: '/drivers', routeName: 'drivers' },
  { label: 'Routes', icon: Route, to: '/routes', routeName: 'routes' },
];

const toolsNav: NavItem[] = [
  { label: 'Geofences', icon: Radar, to: '/geofences', routeName: 'geofences' },
];

const settingsNav: NavItem[] = [
  { label: 'Settings', icon: Settings, to: '/settings', routeName: 'settings' },
];

function isActive(item: NavItem): boolean {
  return route.path.startsWith(item.to);
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Mobile overlay -->
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-40 lg:hidden"
      @click="mobileMenuOpen = false"
    />

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-neutral-900 transition-all duration-200 ease-in-out',
        sidebarCollapsed ? 'w-[72px]' : 'w-64',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <!-- Logo -->
      <div class="h-16 px-5 flex items-center border-b border-neutral-800 flex-shrink-0">
        <h1 v-if="!sidebarCollapsed" class="text-lg font-bold text-white">NexusFleet</h1>
        <span v-else class="text-lg font-bold text-white">N</span>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto py-3">
        <!-- Main group -->
        <div class="space-y-0.5">
          <RouterLink
            v-for="item in mainNav"
            :key="item.routeName"
            :to="item.to"
            :class="[
              'relative flex items-center gap-3 px-3 py-2.5 mx-3 rounded-lg text-sm font-medium transition-all duration-150',
              isActive(item)
                ? 'bg-primary-800 text-white shadow-sm shadow-primary-900/50'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100',
            ]"
            @click="mobileMenuOpen = false"
          >
            <!-- Active pill indicator -->
            <div
              v-if="isActive(item)"
              class="absolute left-0 w-1 h-6 bg-primary-400 rounded-full"
            />
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span v-if="!sidebarCollapsed">{{ item.label }}</span>
          </RouterLink>
        </div>

        <!-- Tools divider -->
        <div class="border-t border-neutral-800 my-3 mx-3" />

        <div class="space-y-0.5">
          <RouterLink
            v-for="item in toolsNav"
            :key="item.routeName"
            :to="item.to"
            :class="[
              'relative flex items-center gap-3 px-3 py-2.5 mx-3 rounded-lg text-sm font-medium transition-all duration-150',
              isActive(item)
                ? 'bg-primary-800 text-white shadow-sm shadow-primary-900/50'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100',
            ]"
            @click="mobileMenuOpen = false"
          >
            <div
              v-if="isActive(item)"
              class="absolute left-0 w-1 h-6 bg-primary-400 rounded-full"
            />
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span v-if="!sidebarCollapsed">{{ item.label }}</span>
          </RouterLink>
        </div>

        <!-- Settings divider -->
        <div class="border-t border-neutral-800 my-3 mx-3" />

        <div class="space-y-0.5">
          <RouterLink
            v-for="item in settingsNav"
            :key="item.routeName"
            :to="item.to"
            :class="[
              'relative flex items-center gap-3 px-3 py-2.5 mx-3 rounded-lg text-sm font-medium transition-all duration-150',
              isActive(item)
                ? 'bg-primary-800 text-white shadow-sm shadow-primary-900/50'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100',
            ]"
            @click="mobileMenuOpen = false"
          >
            <div
              v-if="isActive(item)"
              class="absolute left-0 w-1 h-6 bg-primary-400 rounded-full"
            />
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span v-if="!sidebarCollapsed">{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <!-- User area -->
      <div class="border-t border-neutral-800 p-3 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
          >
            {{ userInitials }}
          </div>
          <div v-if="!sidebarCollapsed" class="min-w-0">
            <p class="text-sm font-medium text-neutral-100 truncate">{{ userName }}</p>
            <p class="text-xs text-neutral-400 capitalize">{{ userRole }}</p>
          </div>
        </div>
      </div>

      <!-- Collapse toggle -->
      <button
        class="hidden lg:flex items-center justify-center h-10 border-t border-neutral-800 text-neutral-400 hover:text-white transition-colors"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <ChevronLeft v-if="!sidebarCollapsed" class="w-5 h-5" />
        <ChevronRight v-else class="w-5 h-5" />
      </button>
    </aside>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top header bar -->
      <header
        class="h-16 bg-white border-b border-neutral-200 px-6 flex items-center justify-between sticky top-0 z-30 flex-shrink-0"
      >
        <div class="flex items-center gap-4">
          <!-- Hamburger for mobile -->
          <button
            class="lg:hidden text-neutral-600 hover:text-neutral-800"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <Menu v-if="!mobileMenuOpen" class="w-6 h-6" />
            <X v-else class="w-6 h-6" />
          </button>
          <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">{{ pageTitle }}</h1>
        </div>

        <div class="flex items-center gap-4">
          <!-- Connection status -->
          <ConnectionStatus :status="trackingStore.connectionStatus" />

          <!-- Notification bell -->
          <button class="relative text-neutral-500 hover:text-neutral-700 transition-colors">
            <Bell class="w-5 h-5" />
            <span
              v-if="notificationStore.unreadCount > 0"
              class="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
            </span>
          </button>

          <!-- User avatar + dropdown -->
          <div class="relative">
            <button
              class="w-8 h-8 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center"
              @click="userDropdownOpen = !userDropdownOpen"
            >
              {{ userInitials }}
            </button>
            <div
              v-if="userDropdownOpen"
              class="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-50"
              @click="userDropdownOpen = false"
            >
              <div class="px-4 py-2 border-b border-neutral-100">
                <p class="text-sm font-medium text-neutral-800">{{ userName }}</p>
                <p class="text-xs text-neutral-400">{{ authStore.user?.email }}</p>
              </div>
              <button
                class="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                @click="handleLogout"
              >
                <LogOut class="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Content area -->
      <main class="flex-1 overflow-auto bg-neutral-50 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
