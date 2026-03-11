<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store';

defineProps<{ collapsed: boolean }>();
defineEmits<{ toggle: [] }>();

const auth = useAuthStore();

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
  { label: 'Shipments', to: '/shipments', icon: 'package' },
  { label: 'Vehicles', to: '/vehicles', icon: 'truck' },
  { label: 'Drivers', to: '/drivers', icon: 'users' },
  { label: 'Routes', to: '/routes', icon: 'map' },
  { label: 'Geofences', to: '/geofences', icon: 'target' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
];

const iconPaths: Record<string, string> = {
  grid: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
  package:
    'M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  truck: 'M1 3h15v13H1V3zm15 5h4l3 3v5h-7V8zM5.5 18a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm13 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75',
  map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zm7-4v16m8-12v16',
  target: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-6a4 4 0 100-8 4 4 0 000 8zm0-2a2 2 0 100-4 2 2 0 000 4z',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zm8.59-3c0-.38-.04-.75-.09-1.12l2.4-1.88a.58.58 0 00.14-.73l-2.27-3.93a.58.58 0 00-.7-.25l-2.83 1.14a8.3 8.3 0 00-1.93-1.12L14.89.46A.56.56 0 0014.33 0H9.78a.56.56 0 00-.56.46L8.7 3.11A8.5 8.5 0 006.78 4.23L3.95 3.09a.56.56 0 00-.7.25L1.02 7.27a.57.57 0 00.14.73l2.4 1.88A9 9 0 003.47 11c0 .38.04.75.09 1.12l-2.4 1.88a.58.58 0 00-.14.73l2.27 3.93c.14.25.45.34.7.25l2.83-1.14c.6.44 1.24.82 1.93 1.12l.52 2.65c.05.27.28.46.56.46h4.55c.28 0 .5-.19.56-.46l.52-2.65a8.5 8.5 0 001.93-1.12l2.83 1.14c.25.1.56 0 .7-.25l2.27-3.93a.57.57 0 00-.14-.73l-2.4-1.88c.05-.37.09-.74.09-1.12z',
};
</script>

<template>
  <aside
    class="bg-slate-800 text-white flex flex-col transition-all duration-200"
    :class="collapsed ? 'w-16' : 'w-64'"
  >
    <div class="flex items-center justify-between h-16 px-4 border-b border-slate-700">
      <span v-if="!collapsed" class="text-lg font-bold tracking-tight">PulseFleet</span>
      <button
        class="p-1 rounded hover:bg-slate-700 text-slate-300"
        @click="$emit('toggle')"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>

    <nav class="flex-1 py-4 space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        active-class="!bg-slate-700 !text-white"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" :d="iconPaths[item.icon]" />
        </svg>
        <span v-if="!collapsed" class="ml-3">{{ item.label }}</span>
      </router-link>
    </nav>

    <div v-if="auth.user" class="border-t border-slate-700 p-4 flex items-center">
      <div class="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
        {{ auth.user.first_name[0] }}{{ auth.user.last_name[0] }}
      </div>
      <div v-if="!collapsed" class="ml-3 min-w-0">
        <p class="text-sm font-medium text-white truncate">{{ auth.userFullName }}</p>
        <p class="text-xs text-slate-400 truncate">{{ auth.user.email }}</p>
      </div>
    </div>
  </aside>
</template>
