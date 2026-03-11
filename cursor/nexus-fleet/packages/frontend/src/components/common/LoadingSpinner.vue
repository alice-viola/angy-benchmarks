<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg';
}>(), {
  size: 'md',
});

const sizeClasses: Record<string, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};
</script>

<template>
  <div
    :class="[
      'animate-spin rounded-full border-primary-600 border-t-transparent',
      sizeClasses[size],
    ]"
    role="status"
    aria-label="Loading"
  />
</template>
