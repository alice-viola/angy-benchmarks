<script setup lang="ts">
defineProps<{
  items: { label: string; to?: string }[];
}>();
</script>

<template>
  <nav aria-label="Breadcrumb">
    <ol class="flex items-center gap-1 text-sm">
      <li v-for="(item, idx) in items" :key="idx" class="flex items-center gap-1">
        <svg
          v-if="idx > 0"
          class="h-4 w-4 shrink-0 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <RouterLink
          v-if="item.to"
          :to="item.to"
          class="font-medium text-slate-500 hover:text-primary-600 transition-colors"
        >
          {{ item.label }}
        </RouterLink>
        <span v-else class="font-medium text-slate-900">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>
