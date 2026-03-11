<script setup lang="ts">
import { useToastStore } from '@/stores/toast.store';

const toast = useToastStore();

const colorMap: Record<string, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500 text-black',
  info: 'bg-blue-500',
};
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 max-w-sm">
    <div
      v-for="t in toast.toasts"
      :key="t.id"
      class="px-4 py-3 rounded-lg shadow-lg text-white text-sm flex items-center justify-between"
      :class="colorMap[t.type] || 'bg-blue-500'"
    >
      <span>{{ t.message }}</span>
      <button class="ml-3 opacity-70 hover:opacity-100" @click="toast.remove(t.id)">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
