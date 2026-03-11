<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  current: number;
  max: number;
}>();

const percentage = computed(() => {
  if (props.max <= 0) return 0;
  return Math.round((props.current / props.max) * 100);
});

const barColor = computed(() => {
  if (percentage.value > 100) return 'bg-red-500';
  if (percentage.value >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
});
</script>

<template>
  <div>
    <div class="flex justify-between text-xs text-slate-600 mb-1">
      <span>Cargo: {{ current }} kg / {{ max }} kg</span>
      <span :class="percentage > 100 ? 'text-red-600 font-medium' : ''">{{ percentage }}%</span>
    </div>
    <div class="w-full bg-slate-200 rounded-full h-2.5">
      <div
        class="h-2.5 rounded-full transition-all"
        :class="barColor"
        :style="{ width: `${Math.min(percentage, 100)}%` }"
      />
    </div>
  </div>
</template>
