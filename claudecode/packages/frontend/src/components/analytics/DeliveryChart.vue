<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useApi } from '@/composables/useApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const api = useApi();

const deliveryData = ref<{
  dates: string[];
  completed: number[];
  failed: number[];
}>({ dates: [], completed: [], failed: [] });

const loading = ref(true);

const chartData = computed(() => ({
  labels: deliveryData.value.dates,
  datasets: [
    {
      label: 'Completed',
      data: deliveryData.value.completed,
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#10B981',
      pointRadius: 3,
      pointHoverRadius: 6,
    },
    {
      label: 'Failed',
      data: deliveryData.value.failed,
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#EF4444',
      pointRadius: 3,
      pointHoverRadius: 6,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
        font: { size: 12 },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#1F2937',
      bodyColor: '#4B5563',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: 12,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 }, maxRotation: 45 },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0, 0, 0, 0.05)' },
      ticks: { font: { size: 11 }, stepSize: 1 },
    },
  },
};

onMounted(async () => {
  try {
    const response = await api.get<typeof deliveryData.value>('/dashboard/delivery-trend');
    if (response.success) {
      deliveryData.value = response.data;
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="card">
    <h3 class="text-sm font-semibold text-gray-900 mb-4">Deliveries - Last 30 Days</h3>
    <div v-if="loading" class="h-64 flex items-center justify-center">
      <div class="skeleton h-full w-full rounded" />
    </div>
    <div v-else-if="deliveryData.dates.length > 0" class="h-64">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex items-center justify-center h-64 text-sm text-gray-500">
      No delivery data available.
    </div>
  </div>
</template>
