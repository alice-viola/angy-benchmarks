<script setup lang="ts">
import { computed } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

const props = defineProps<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>();

const emit = defineEmits<{
  'update:page': [value: number];
  'update:pageSize': [value: number];
}>();

const pageSizeOptions = [10, 25, 50, 100];

const startItem = computed(() => (props.page - 1) * props.pageSize + 1);
const endItem = computed(() => Math.min(props.page * props.pageSize, props.totalItems));

const visiblePages = computed(() => {
  const pages: number[] = [];
  const total = props.totalPages;
  const current = props.page;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push(-1); // ellipsis
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-1); // ellipsis
    pages.push(total);
  }
  return pages;
});
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-white">
    <div class="flex items-center gap-2 text-xs text-neutral-500">
      <span>Showing {{ startItem }}–{{ endItem }} of {{ totalItems }}</span>
      <select
        :value="pageSize"
        class="h-8 bg-white border border-neutral-300 rounded-md px-2 text-xs text-neutral-700"
        @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }} / page</option>
      </select>
    </div>

    <div class="flex items-center gap-1">
      <button
        class="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        <ChevronLeft class="w-4 h-4" />
      </button>

      <template v-for="(p, idx) in visiblePages" :key="idx">
        <span v-if="p === -1" class="w-8 h-8 flex items-center justify-center text-neutral-400 text-xs">...</span>
        <button
          v-else
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors',
            p === page
              ? 'bg-primary-500 text-white'
              : 'text-neutral-600 hover:bg-neutral-100',
          ]"
          @click="emit('update:page', p)"
        >
          {{ p }}
        </button>
      </template>

      <button
        class="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        :disabled="page >= totalPages"
        @click="emit('update:page', page + 1)"
      >
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
