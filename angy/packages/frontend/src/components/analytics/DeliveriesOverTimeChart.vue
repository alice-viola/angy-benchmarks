<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { api } from '@/plugins/axios';

Chart.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
);

interface DailyData {
  date: string;
  completed: number;
  failed: number;
}

const dailyData = ref<DailyData[]>([]);

onMounted(async () => {
  try {
    const res = await api.get('/api/v1/analytics/shipments');
    const d = res.data.data ?? res.data;
    dailyData.value = d.daily ?? [];
  } catch {
    // silent
  }
});

const chartData = computed(() => ({
  labels: dailyData.value.map((d) => d.date),
  datasets: [
    {
      label: 'Completed',
      data: dailyData.value.map((d) => d.completed),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.1)',
      fill: true,
      tension: 0.3,
    },
    {
      label: 'Failed',
      data: dailyData.value.map((d) => d.failed),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.1)',
      fill: true,
      tension: 0.3,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  plugins: { legend: { position: 'bottom' as const } },
  scales: {
    y: { beginAtZero: true },
  },
};
</script>

<template>
  <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
    <h3 class="text-sm font-medium text-slate-700 mb-3">
      Deliveries Over Time (30 Days)
    </h3>
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
