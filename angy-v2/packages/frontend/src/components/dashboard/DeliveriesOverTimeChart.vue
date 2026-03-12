<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ChartData,
} from 'chart.js';
import LoadingSkeleton from '../common/LoadingSkeleton.vue';
import { TrendingUp } from 'lucide-vue-next';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface DailyData {
  date: string;
  completed: number;
  failed: number;
}

const props = defineProps<{
  data: DailyData[] | null;
  loading?: boolean;
}>();

const chartData = computed<ChartData<'line'>>(() => {
  if (!props.data || props.data.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = props.data.map((d) => {
    const date = new Date(d.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return {
    labels,
    datasets: [
      {
        label: 'Completed',
        data: props.data.map((d) => d.completed),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#10B981',
        fill: true,
      },
      {
        label: 'Failed',
        data: props.data.map((d) => d.failed),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#EF4444',
        fill: true,
      },
    ],
  };
});

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        font: { family: 'Inter', size: 12 },
        color: '#64748B',
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 6,
        boxHeight: 6,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: '#1E293B',
      titleFont: { family: 'Inter', size: 12, weight: 'bold' as const },
      bodyFont: { family: 'Inter', size: 12 },
      padding: { x: 12, y: 8 },
      cornerRadius: 8,
      displayColors: true,
      boxWidth: 8,
      boxHeight: 8,
      boxPadding: 4,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: { family: 'Inter', size: 11 },
        color: '#94A3B8',
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 10,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0,0,0,0.04)',
      },
      ticks: {
        font: { family: 'Inter', size: 11 },
        color: '#94A3B8',
        precision: 0,
      },
    },
  },
};

const hasData = computed(() => props.data && props.data.length > 0);
</script>

<template>
  <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-medium text-neutral-800">Deliveries Over Time</h2>
      <span class="text-xs text-neutral-400">Last 30 days</span>
    </div>

    <template v-if="loading">
      <div class="space-y-3 h-64">
        <LoadingSkeleton v-for="i in 5" :key="i" :width="`${60 + Math.random() * 40}%`" height="8px" />
      </div>
    </template>

    <template v-else-if="!hasData">
      <div class="flex flex-col items-center justify-center h-64">
        <div class="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
          <TrendingUp class="w-6 h-6 text-neutral-300" />
        </div>
        <p class="text-sm text-neutral-500">No delivery data yet</p>
        <p class="text-xs text-neutral-400 mt-1">Data will appear after deliveries are completed</p>
      </div>
    </template>

    <template v-else>
      <div class="h-64">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </template>
  </div>
</template>
