<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
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
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps<{
  data: {
    labels: string[]
    datasets: { label: string; data: number[]; borderColor: string }[]
  }
  title: string
}>()

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.data.labels,
  datasets: props.data.datasets.map((ds) => ({
    ...ds,
    tension: 0.4,
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 6,
    pointBackgroundColor: ds.borderColor,
    fill: true,
    backgroundColor: ds.borderColor + '15',
  })),
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top',
      align: 'end',
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
      mode: 'index',
      intersect: false,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 11 },
        color: '#9ca3af',
        maxRotation: 45,
      },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#f3f4f6' },
      ticks: {
        font: { size: 11 },
        color: '#9ca3af',
        precision: 0,
      },
    },
  },
}))
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <h3 class="mb-4 text-sm font-semibold text-gray-700">{{ title }}</h3>
    <div style="height: 300px">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
