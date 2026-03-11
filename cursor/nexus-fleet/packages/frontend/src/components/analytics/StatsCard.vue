<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    value: string | number
    icon: string
    trend?: { value: number; direction: 'up' | 'down' }
    color?: 'blue' | 'green' | 'red' | 'amber'
  }>(),
  { color: 'blue' },
)

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    accent: 'border-blue-500',
    trendUp: 'text-blue-600',
  },
  green: {
    bg: 'bg-emerald-50',
    icon: 'text-emerald-600',
    accent: 'border-emerald-500',
    trendUp: 'text-emerald-600',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    accent: 'border-red-500',
    trendUp: 'text-red-600',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    accent: 'border-amber-500',
    trendUp: 'text-amber-600',
  },
} as const
</script>

<template>
  <div
    class="relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    :class="`border-l-4 ${colorMap[props.color].accent}`"
  >
    <div class="flex items-start justify-between">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-gray-500">{{ title }}</p>
        <p class="mt-1 text-3xl font-bold tracking-tight text-gray-900">{{ value }}</p>
        <div v-if="trend" class="mt-2 flex items-center gap-1 text-sm font-medium">
          <svg
            v-if="trend.direction === 'up'"
            class="h-4 w-4 text-emerald-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <svg
            v-else
            class="h-4 w-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span :class="trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600'">
            {{ Math.abs(trend.value) }}%
          </span>
          <span class="text-gray-400">vs last period</span>
        </div>
      </div>
      <div
        class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
        :class="colorMap[props.color].bg"
      >
        <span class="text-2xl" :class="colorMap[props.color].icon">{{ icon }}</span>
      </div>
    </div>
  </div>
</template>
