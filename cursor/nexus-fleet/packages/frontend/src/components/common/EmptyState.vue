<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  description?: string;
  icon?: string;
}>(), {
  description: undefined,
  icon: undefined,
});
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <!-- Icon -->
    <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
      <slot name="icon">
        <span v-if="icon" class="text-3xl">{{ icon }}</span>
        <svg
          v-else
          class="h-8 w-8 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </slot>
    </div>

    <h3 class="text-base font-semibold text-slate-900">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-slate-500">{{ description }}</p>

    <!-- Action slot -->
    <div v-if="$slots.action" class="mt-6">
      <slot name="action" />
    </div>
  </div>
</template>
