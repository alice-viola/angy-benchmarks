<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';
import type { FleetStats } from '@/types';

const api = useApi();
const stats = ref<FleetStats | null>(null);
const loading = ref(true);

const cards = [
  {
    group: 'Vehicles',
    items: [
      { key: 'totalVehicles', label: 'Total', icon: 'M8 17h8M8 17v-4m8 4v-4m-8 0h8m-8 0V9m8 4V9m0 0H8m8 0l-1.5-4h-5L8 9', color: 'bg-primary-500' },
      { key: 'activeVehicles', label: 'Active', icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'bg-success-500' },
      { key: 'availableVehicles', label: 'Available', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-blue-500' },
      { key: 'maintenanceVehicles', label: 'Maintenance', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', color: 'bg-warning-500' },
    ],
  },
  {
    group: 'Drivers',
    items: [
      { key: 'totalDrivers', label: 'Total', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'bg-indigo-500' },
      { key: 'onDutyDrivers', label: 'On Duty', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'bg-success-500' },
      { key: 'offDutyDrivers', label: 'Off Duty', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', color: 'bg-gray-500' },
    ],
  },
  {
    group: 'Shipments',
    items: [
      { key: 'activeShipments', label: 'Active', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'bg-accent-500' },
      { key: 'deliveredToday', label: 'Delivered Today', icon: 'M5 13l4 4L19 7', color: 'bg-success-500' },
    ],
  },
];

onMounted(async () => {
  try {
    const response = await api.get<FleetStats>('/dashboard/stats');
    if (response.success) {
      stats.value = response.data;
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-4">
    <div v-for="group in cards" :key="group.group">
      <h3 class="text-sm font-medium text-gray-500 mb-2">{{ group.group }}</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          v-for="item in group.items"
          :key="item.key"
          class="card flex items-center gap-3 !p-4"
        >
          <div :class="[item.color, 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white']">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
            </svg>
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ item.label }}</p>
            <p v-if="loading" class="skeleton h-6 w-10 mt-1" />
            <p v-else class="text-xl font-bold text-gray-900">
              {{ stats ? (stats as any)[item.key] : 0 }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
