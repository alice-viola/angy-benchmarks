<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useApi } from '@/composables/useApi';
import { SHIPMENT_STATUSES } from '@nexus-fleet/shared';

ChartJS.register(ArcElement, Tooltip, Legend);

const emit = defineEmits<{
  'filter-status': [status: string];
}>();

const api = useApi();
const statusCounts = ref<Record<string, number>>({});
const loading = ref(true);

const statusColors: Record<string, string> = {
  draft: '#9CA3AF',
  confirmed: '#3B82F6',
  assigned: '#6366F1',
  picked_up: '#8B5CF6',
  in_transit: '#F59E0B',
  delivered: '#10B981',
  completed: '#059669',
  failed: '#EF4444',
  cancelled: '#D1D5DB',
};

const chartData = computed(() => ({
  labels: Object.keys(statusCounts.value).map(
    (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  ),
  datasets: [
    {
      data: Object.values(statusCounts.value),
      backgroundColor: Object.keys(statusCounts.value).map(
        (s) => statusColors[s] || '#6B7280',
      ),
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 8,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
        font: { size: 12 },
      },
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const percentage = ((context.parsed / total) * 100).toFixed(1);
          return `${context.label}: ${context.parsed} (${percentage}%)`;
        },
      },
    },
  },
  onClick: (_event: any, elements: any[]) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const status = Object.keys(statusCounts.value)[index];
      emit('filter-status', status);
    }
  },
};

onMounted(async () => {
  try {
    const response = await api.get<Record<string, number>>('/dashboard/shipments-by-status');
    if (response.success) {
      statusCounts.value = response.data;
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="card">
    <h3 class="text-sm font-semibold text-gray-900 mb-4">Shipments by Status</h3>
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="skeleton h-48 w-48 rounded-full" />
    </div>
    <div v-else-if="Object.keys(statusCounts).length > 0" class="h-64">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex items-center justify-center h-64 text-sm text-gray-500">
      No shipment data available.
    </div>
  </div>
</template>
