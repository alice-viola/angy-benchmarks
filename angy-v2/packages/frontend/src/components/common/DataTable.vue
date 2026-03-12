<script setup lang="ts" generic="T">
import { ref, computed } from 'vue';
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronRight } from 'lucide-vue-next';
import LoadingSkeleton from './LoadingSkeleton.vue';
import Pagination from './Pagination.vue';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
}

const props = defineProps<{
  columns: Column[];
  data: T[];
  loading: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
  navigable?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}>();

const emit = defineEmits<{
  'update:page': [value: number];
  'update:pageSize': [value: number];
  'update:sort': [value: { key: string; direction: 'asc' | 'desc' }];
  'update:filters': [value: Record<string, string>];
  'row-click': [item: T];
}>();

const sortKey = ref('');
const sortDirection = ref<'asc' | 'desc' | 'none'>('none');
const filters = ref<Record<string, string>>({});
let filterTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const totalPages = computed(() => Math.ceil(props.totalItems / props.pageSize) || 1);

function toggleSort(col: Column) {
  if (!col.sortable) return;
  if (sortKey.value !== col.key) {
    sortKey.value = col.key;
    sortDirection.value = 'asc';
  } else if (sortDirection.value === 'asc') {
    sortDirection.value = 'desc';
  } else {
    sortDirection.value = 'none';
    sortKey.value = '';
  }
  if (sortKey.value) {
    emit('update:sort', { key: sortKey.value, direction: sortDirection.value as 'asc' | 'desc' });
  }
}

function onFilterInput(key: string, value: string) {
  filters.value[key] = value;
  if (filterTimers[key]) clearTimeout(filterTimers[key]);
  filterTimers[key] = setTimeout(() => {
    emit('update:filters', { ...filters.value });
  }, 300);
}

function getCellValue(item: T, key: string): unknown {
  return (item as Record<string, unknown>)[key];
}
</script>

<template>
  <!-- Desktop table -->
  <div class="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full hidden md:table">
        <thead>
          <tr class="bg-neutral-50 border-b border-neutral-200">
            <th
              v-for="col in columns"
              :key="col.key"
              :class="[
                'text-xs font-semibold uppercase tracking-wider px-4 py-3',
                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                col.sortable ? 'cursor-pointer select-none' : '',
                sortKey === col.key ? 'text-primary-600' : 'text-neutral-400',
              ]"
              @click="toggleSort(col)"
            >
              <div class="flex items-center gap-1" :class="{ 'justify-end': col.align === 'right', 'justify-center': col.align === 'center' }">
                <span>{{ col.label }}</span>
                <template v-if="col.sortable">
                  <ArrowUp v-if="sortKey === col.key && sortDirection === 'asc'" class="w-3.5 h-3.5" />
                  <ArrowDown v-else-if="sortKey === col.key && sortDirection === 'desc'" class="w-3.5 h-3.5" />
                  <ArrowUpDown v-else class="w-3.5 h-3.5 text-neutral-300" />
                </template>
              </div>
              <!-- Column filter -->
              <div v-if="col.filterable" class="mt-1" @click.stop>
                <input
                  type="text"
                  :placeholder="`Filter ${col.label.toLowerCase()}...`"
                  class="w-full h-7 bg-white border border-neutral-200 rounded px-2 text-xs text-neutral-600 placeholder:text-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 focus:outline-none"
                  :value="filters[col.key] || ''"
                  @input="onFilterInput(col.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </th>
            <th v-if="navigable" class="w-10" />
          </tr>
        </thead>
        <tbody>
          <!-- Loading skeleton -->
          <template v-if="loading">
            <tr v-for="i in 5" :key="i" class="border-b border-neutral-100">
              <td v-for="col in columns" :key="col.key" class="px-4 py-3.5">
                <LoadingSkeleton :width="Math.random() * 40 + 60 + '%'" height="14px" rounded="rounded" />
              </td>
              <td v-if="navigable" class="px-4 py-3.5">
                <LoadingSkeleton width="16px" height="14px" rounded="rounded" />
              </td>
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-else-if="data.length === 0">
            <td :colspan="columns.length + (navigable ? 1 : 0)">
              <div class="flex flex-col items-center justify-center py-16 px-4">
                <div class="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                  <slot name="empty-icon">
                    <div class="w-8 h-8 text-neutral-300">
                      <!-- Default empty icon placeholder -->
                    </div>
                  </slot>
                </div>
                <h3 class="text-lg font-semibold text-neutral-700 mb-1">
                  {{ emptyTitle || 'No data found' }}
                </h3>
                <p class="text-sm text-neutral-400 text-center max-w-sm">
                  {{ emptyDescription || 'There are no items to display at this time.' }}
                </p>
                <div class="mt-6">
                  <slot name="empty-action" />
                </div>
              </div>
            </td>
          </tr>

          <!-- Data rows -->
          <template v-else>
            <tr
              v-for="(item, idx) in data"
              :key="idx"
              :class="[
                'border-b border-neutral-100 hover:bg-primary-50/50 transition-colors duration-100',
                navigable ? 'cursor-pointer' : '',
              ]"
              @click="navigable ? emit('row-click', item) : undefined"
            >
              <td
                v-for="(col, colIdx) in columns"
                :key="col.key"
                :class="[
                  'px-4 py-3.5 text-sm',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                  colIdx === 0 ? 'font-medium text-neutral-800' : 'text-neutral-600',
                ]"
              >
                <slot :name="`cell-${col.key}`" :item="item" :value="getCellValue(item, col.key)">
                  {{ getCellValue(item, col.key) }}
                </slot>
              </td>
              <td v-if="navigable" class="px-2 py-3.5">
                <ChevronRight class="w-4 h-4 text-neutral-300" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Mobile card layout -->
    <div class="md:hidden">
      <template v-if="loading">
        <div v-for="i in 5" :key="i" class="p-4 border-b border-neutral-100 space-y-2">
          <LoadingSkeleton width="60%" height="16px" />
          <LoadingSkeleton width="80%" height="12px" />
          <LoadingSkeleton width="40%" height="12px" />
        </div>
      </template>

      <template v-else-if="data.length === 0">
        <div class="flex flex-col items-center justify-center py-16 px-4">
          <h3 class="text-lg font-semibold text-neutral-700 mb-1">{{ emptyTitle || 'No data found' }}</h3>
          <p class="text-sm text-neutral-400 text-center max-w-sm">{{ emptyDescription || 'There are no items to display.' }}</p>
        </div>
      </template>

      <template v-else>
        <div
          v-for="(item, idx) in data"
          :key="idx"
          :class="[
            'p-4 border-b border-neutral-100',
            navigable ? 'cursor-pointer active:bg-neutral-50' : '',
          ]"
          @click="navigable ? emit('row-click', item) : undefined"
        >
          <div class="space-y-1.5">
            <div v-for="col in columns" :key="col.key" class="flex justify-between items-center">
              <span class="text-xs font-medium text-neutral-400 uppercase">{{ col.label }}</span>
              <span class="text-sm text-neutral-700">
                <slot :name="`cell-${col.key}`" :item="item" :value="getCellValue(item, col.key)">
                  {{ getCellValue(item, col.key) }}
                </slot>
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Pagination -->
    <Pagination
      v-if="totalItems > 0"
      :page="page"
      :page-size="pageSize"
      :total-items="totalItems"
      :total-pages="totalPages"
      @update:page="emit('update:page', $event)"
      @update:page-size="emit('update:pageSize', $event)"
    />
  </div>
</template>
