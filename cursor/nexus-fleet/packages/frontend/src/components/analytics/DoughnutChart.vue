<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
  type ActiveElement,
  type ChartEvent,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  data: Record<string, number>
  title: string
}>()

const emit = defineEmits<{
  segmentClick: [status: string]
}>()

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  confirmed: '#60a5fa',
  assigned: '#818cf8',
  picked_up: '#a78bfa',
  in_transit: '#38bdf8',
  delivered: '#34d399',
  completed: '#10b981',
  failed: '#f87171',
  cancelled: '#fb923c',
}

const DEFAULT_PALETTE = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
]

function colorFor(key: string, idx: number): string {
  return STATUS_COLORS[key] ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]
}

const labels = computed(() => Object.keys(props.data))
const values = computed(() => Object.values(props.data))

const chartData = computed<ChartData<'doughnut'>>(() => ({
  labels: labels.value.map((l) => l.replace(/_/g, ' ')),
  datasets: [
    {
      data: values.value,
      backgroundColor: labels.value.map((l, i) => colorFor(l, i)),
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 6,
    },
  ],
}))

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 10,
        font: { size: 12 },
      },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label(ctx) {
          const total = values.value.reduce((a, b) => a + b, 0)
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0'
          return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`
        },
      },
    },
  },
  onClick(_event: ChartEvent, elements: ActiveElement[]) {
    if (elements.length > 0) {
      const idx = elements[0].index
      emit('segmentClick', labels.value[idx])
    }
  },
}))

const total = computed(() => values.value.reduce((a, b) => a + b, 0))
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <h3 class="mb-4 text-sm font-semibold text-gray-700">{{ title }}</h3>
    <div class="relative mx-auto" style="height: 280px">
      <Doughnut :data="chartData" :options="chartOptions" />
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div class="text-center">
          <p class="text-2xl font-bold text-gray-800">{{ total }}</p>
          <p class="text-xs text-gray-400">Total</p>
        </div>
      </div>
    </div>
  </div>
</template>
