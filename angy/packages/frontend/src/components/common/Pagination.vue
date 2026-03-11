<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  page: number;
  pageSize: number;
  totalItems: number;
}>();

const emit = defineEmits<{
  'update:page': [page: number];
  'update:pageSize': [size: number];
}>();

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)));

const visiblePages = computed(() => {
  const pages: number[] = [];
  const start = Math.max(1, props.page - 2);
  const end = Math.min(totalPages.value, props.page + 2);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

const pageSizes = [10, 25, 50, 100];
</script>

<template>
  <div class="flex items-center justify-between px-2 py-3 text-sm">
    <div class="flex items-center space-x-2">
      <label class="text-slate-600">Rows per page:</label>
      <select
        :value="pageSize"
        class="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="s in pageSizes" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div class="flex items-center space-x-1">
      <button
        class="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40"
        :disabled="page <= 1"
        @click="emit('update:page', 1)"
      >
        First
      </button>
      <button
        class="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        Prev
      </button>

      <button
        v-for="p in visiblePages"
        :key="p"
        class="px-3 py-1 rounded"
        :class="p === page ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-700'"
        @click="emit('update:page', p)"
      >
        {{ p }}
      </button>

      <button
        class="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="emit('update:page', page + 1)"
      >
        Next
      </button>
      <button
        class="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="emit('update:page', totalPages)"
      >
        Last
      </button>
    </div>
  </div>
</template>
