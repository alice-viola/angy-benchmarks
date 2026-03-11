<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/plugins/axios';

interface OverviewData {
  vehicles_total: number;
  vehicles_active: number;
  vehicles_available: number;
  vehicles_in_transit: number;
  drivers_available: number;
  drivers_driving: number;
  shipments_total: number;
  shipments_delivered_today: number;
}

const data = ref<OverviewData | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const res = await api.get('/api/v1/analytics/overview');
    data.value = res.data.data ?? res.data;
  } catch {
    // silent
  } finally {
    loading.value = false;
  }
});

const cards = [
  { key: 'vehicles_total', label: 'Total Vehicles' },
  { key: 'vehicles_active', label: 'Active Vehicles' },
  { key: 'vehicles_available', label: 'Available Vehicles' },
  { key: 'vehicles_in_transit', label: 'In Transit' },
  { key: 'drivers_available', label: 'Available Drivers' },
  { key: 'drivers_driving', label: 'Driving' },
  { key: 'shipments_total', label: 'Total Shipments' },
  { key: 'shipments_delivered_today', label: 'Delivered Today' },
];
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <template v-if="loading">
      <div
        v-for="i in 8"
        :key="i"
        class="bg-white rounded-lg border border-slate-200 shadow-sm p-4"
      >
        <div class="animate-pulse space-y-2">
          <div class="h-4 bg-slate-200 rounded w-24" />
          <div class="h-8 bg-slate-200 rounded w-16" />
        </div>
      </div>
    </template>
    <template v-else-if="data">
      <div
        v-for="card in cards"
        :key="card.key"
        class="bg-white rounded-lg border border-slate-200 shadow-sm p-4"
      >
        <p class="text-sm text-slate-500">{{ card.label }}</p>
        <p class="text-2xl font-bold text-slate-900 mt-1">
          {{ data[card.key as keyof OverviewData] ?? 0 }}
        </p>
      </div>
    </template>
  </div>
</template>
