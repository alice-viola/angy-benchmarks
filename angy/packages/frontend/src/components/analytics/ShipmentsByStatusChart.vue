<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { api } from '@/plugins/axios';

Chart.register(ArcElement, Tooltip, Legend);

const emit = defineEmits<{ filter: [status: string] }>();

const statusData = ref<Record<string, number>>({});

const statusColors: Record<string, string> = {
  draft: '#9ca3af',
  confirmed: '#3b82f6',
  assigned: '#6366f1',
  picked_up: '#a855f7',
  in_transit: '#eab308',
  delivered: '#22c55e',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

onMounted(async () => {
  try {
    const res = await api.get('/api/v1/analytics/shipments');
    const d = res.data.data ?? res.data;
    statusData.value = d.by_status ?? {};
  } catch {
    // silent
  }
});

const chartData = computed(() => {
  const labels = Object.keys(statusData.value);
  return {
    labels: labels.map((s) =>
      s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    ),
    datasets: [
      {
        data: Object.values(statusData.value),
        backgroundColor: labels.map((s) => statusColors[s] || '#9ca3af'),
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  plugins: { legend: { position: 'bottom' as const } },
  onClick: (_event: unknown, elements: Array<{ index: number }>) => {
    if (elements.length > 0) {
      const idx = elements[0].index;
      const status = Object.keys(statusData.value)[idx];
      emit('filter', status);
    }
  },
};
</script>

<template>
  <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
    <h3 class="text-sm font-medium text-slate-700 mb-3">Shipments by Status</h3>
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>
