<script setup lang="ts">
defineProps<{
  width?: string;
  height?: string;
}>();
</script>

<template>
  <div
    class="animate-pulse bg-slate-200 rounded"
    :style="{
      width: width || '100%',
      height: height || '1rem',
    }"
  />
</template>
