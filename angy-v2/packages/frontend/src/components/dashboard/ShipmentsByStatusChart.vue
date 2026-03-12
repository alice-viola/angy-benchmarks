<script setup lang="ts">
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
} from 'chart.js';
import LoadingSkeleton from '../common/LoadingSkeleton.vue';
import { Package } from 'lucide-vue-next';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps<{
  data: Record<string, number> | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  filter: [status: string];
}>();

const chartColors: Record<string, string> = {
  draft: '#94A3B8',
  confirmed: '#3B82F6',
  assigned: '#3B5FEE',
  picked_up: '#FBBF24',
  in_transit: '#F59E0B',
  delivered: '#10B981',
  completed: '#059669',
  failed: '#EF4444',
  cancelled: '#64748B',
};

const fallbackColors = [
  '#3B5FEE',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#F97316',
  '#EC4899',
  '#64748B',
];

const totalShipments = computed(() => {
  if (!props.data) return 0;
  return Object.values(props.data).reduce((sum, val) => sum + val, 0);
});

const chartData = computed<ChartData<'doughnut'>>(() => {
  if (!props.data) return { labels: [], datasets: [] };

  const entries = Object.entries(props.data).filter(([, count]) => count > 0);
  const labels = entries.map(([status]) => status.replace(/_/g, ' '));
  const values = entries.map(([, count]) => count);
  const colors = entries.map(
    ([status], i) => chartColors[status] || fallbackColors[i % fallbackColors.length]
  );

  return {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };
});

const statusKeys = computed(() => {
  if (!props.data) return [];
  return Object.entries(props.data)
    .filter(([, count]) => count > 0)
    .map(([status]) => status);
});

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: {
      display: false,
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
  onClick: (_event, elements) => {
    if (elements.length > 0 && elements[0]) {
      const idx = elements[0].index;
      const status = statusKeys.value[idx];
      if (status) {
        emit('filter', status);
      }
    }
  },
}));

const hasData = computed(() => totalShipments.value > 0);
</script>

<template>
  <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
    <h2 class="text-base font-medium text-neutral-800 mb-4">Shipments by Status</h2>

    <template v-if="loading">
      <div class="flex items-center justify-center h-64">
        <LoadingSkeleton width="180px" height="180px" rounded="rounded-full" />
      </div>
    </template>

    <template v-else-if="!hasData">
      <div class="flex flex-col items-center justify-center h-64">
        <div class="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
          <Package class="w-6 h-6 text-neutral-300" />
        </div>
        <p class="text-sm text-neutral-500">No shipment data</p>
      </div>
    </template>

    <template v-else>
      <div class="relative h-64">
        <Doughnut :data="chartData" :options="chartOptions" />
        <!-- Center total -->
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span class="text-2xl font-bold text-neutral-800">{{ totalShipments }}</span>
          <span class="text-xs text-neutral-400">Total</span>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap gap-3 mt-4">
        <button
          v-for="(count, status) in data"
          :key="String(status)"
          class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors cursor-pointer"
          @click="emit('filter', String(status))"
        >
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: chartColors[String(status)] || '#94A3B8' }"
          />
          <span class="capitalize">{{ String(status).replace(/_/g, ' ') }}</span>
          <span class="font-medium text-neutral-700">{{ count }}</span>
        </button>
      </div>
    </template>
  </div>
</template>
