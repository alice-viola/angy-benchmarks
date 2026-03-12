<script setup lang="ts">
defineProps<{
  width?: string;
  height?: string;
  rounded?: string;
}>();
</script>

<template>
  <div
    :class="[
      'bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] animate-shimmer',
      rounded || 'rounded',
    ]"
    :style="{
      width: width || '100%',
      height: height || '16px',
    }"
  />
</template>
