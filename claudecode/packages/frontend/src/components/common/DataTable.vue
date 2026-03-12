<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, watch } from 'vue';
import type { ColumnDef } from '@/types';

const props = withDefaults(
  defineProps<{
    columns: ColumnDef<T>[];
    data: T[];
    loading?: boolean;
    totalItems?: number;
    page?: number;
    pageSize?: number;
    selectable?: boolean;
  }>(),
  {
    loading: false,
    totalItems: 0,
    page: 1,
    pageSize: 25,
    selectable: false,
  },
);

const emit = defineEmits<{
  'update:page': [page: number];
  'update:pageSize': [size: number];
  'update:sort': [key: string, direction: 'asc' | 'desc' | null];
  'update:filters': [filters: Record<string, string>];
  'row-click': [row: T];
}>();

const sortKey = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc' | null>(null);
const columnFilters = ref<Record<string, string>>({});
const selectedRows = ref<Set<number>>(new Set());
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const totalPages = computed(() =>
  Math.ceil(props.totalItems / props.pageSize),
);

const allSelected = computed(() =>
  props.data.length > 0 && selectedRows.value.size === props.data.length,
);

function handleSort(column: ColumnDef<T>) {
  if (!column.sortable) return;

  const key = String(column.key);
  if (sortKey.value === key) {
    if (sortDirection.value === 'asc') {
      sortDirection.value = 'desc';
    } else if (sortDirection.value === 'desc') {
      sortDirection.value = null;
      sortKey.value = null;
    }
  } else {
    sortKey.value = key;
    sortDirection.value = 'asc';
  }

  emit('update:sort', key, sortDirection.value);
}

function handleFilter(key: string, value: string) {
  columnFilters.value[key] = value;

  if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(() => {
    emit('update:filters', { ...columnFilters.value });
  }, 300);
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedRows.value.clear();
  } else {
    props.data.forEach((_, i) => selectedRows.value.add(i));
  }
}

function toggleSelect(index: number) {
  if (selectedRows.value.has(index)) {
    selectedRows.value.delete(index);
  } else {
    selectedRows.value.add(index);
  }
}

function getCellValue(row: T, column: ColumnDef<T>): string {
  const value = (row as Record<string, any>)[column.key as string];
  if (column.render) {
    return column.render(value, row);
  }
  return value != null ? String(value) : '';
}

function getSortIcon(column: ColumnDef<T>): string {
  if (!column.sortable) return '';
  if (sortKey.value !== String(column.key)) return 'text-gray-300';
  return sortDirection.value === 'asc' ? 'text-primary-500' : 'text-primary-500';
}

watch(
  () => props.data,
  () => {
    selectedRows.value.clear();
  },
);
</script>

<template>
  <!-- Desktop table -->
  <div class="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th v-if="selectable" class="w-10 px-3 py-3">
              <input
                type="checkbox"
                :checked="allSelected"
                class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                @change="toggleSelectAll"
              />
            </th>
            <th
              v-for="column in columns"
              :key="String(column.key)"
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              :class="{ 'cursor-pointer select-none hover:text-gray-700': column.sortable }"
              @click="handleSort(column)"
            >
              <div class="flex items-center gap-1">
                <span>{{ column.label }}</span>
                <span v-if="column.sortable" :class="getSortIcon(column)">
                  <svg v-if="sortKey === String(column.key) && sortDirection === 'asc'" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  <svg v-else-if="sortKey === String(column.key) && sortDirection === 'desc'" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </span>
              </div>
              <!-- Column filter -->
              <input
                v-if="column.filterable"
                type="text"
                :placeholder="`Filter ${column.label}...`"
                class="mt-1 block w-full rounded border border-gray-200 px-2 py-1 text-xs font-normal normal-case"
                @input="(e) => handleFilter(String(column.key), (e.target as HTMLInputElement).value)"
                @click.stop
              />
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <!-- Loading skeletons -->
          <template v-if="loading">
            <tr v-for="i in pageSize" :key="`skeleton-${i}`">
              <td v-if="selectable" class="px-3 py-3">
                <div class="skeleton h-4 w-4 rounded" />
              </td>
              <td v-for="column in columns" :key="`skeleton-${i}-${String(column.key)}`" class="px-4 py-3">
                <div class="skeleton h-4 w-3/4 rounded" />
              </td>
            </tr>
          </template>

          <!-- Data rows -->
          <template v-else-if="data.length > 0">
            <tr
              v-for="(row, index) in data"
              :key="index"
              class="hover:bg-gray-50 cursor-pointer transition-colors"
              @click="emit('row-click', row)"
            >
              <td v-if="selectable" class="px-3 py-3" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedRows.has(index)"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  @change="toggleSelect(index)"
                />
              </td>
              <td
                v-for="column in columns"
                :key="String(column.key)"
                class="whitespace-nowrap px-4 py-3 text-sm text-gray-700"
              >
                <slot :name="`cell-${String(column.key)}`" :row="row" :value="(row as Record<string, any>)[column.key as string]">
                  {{ getCellValue(row, column) }}
                </slot>
              </td>
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-else>
            <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-4 py-12 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p class="mt-2 text-sm text-gray-500">No data found</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalItems > 0" class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
      <div class="text-sm text-gray-500">
        Showing {{ (page - 1) * pageSize + 1 }} to {{ Math.min(page * pageSize, totalItems) }} of {{ totalItems }} results
      </div>
      <div class="flex items-center gap-2">
        <select
          :value="pageSize"
          class="rounded border border-gray-300 px-2 py-1 text-sm"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
        <button
          :disabled="page <= 1"
          class="btn-secondary btn-sm"
          @click="emit('update:page', page - 1)"
        >
          Previous
        </button>
        <span class="text-sm text-gray-700">
          Page {{ page }} of {{ totalPages }}
        </span>
        <button
          :disabled="page >= totalPages"
          class="btn-secondary btn-sm"
          @click="emit('update:page', page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>

  <!-- Mobile card layout -->
  <div class="md:hidden space-y-3">
    <template v-if="loading">
      <div v-for="i in 5" :key="`m-skeleton-${i}`" class="card">
        <div class="space-y-2">
          <div class="skeleton h-4 w-1/2 rounded" />
          <div class="skeleton h-3 w-3/4 rounded" />
          <div class="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
    </template>

    <template v-else-if="data.length > 0">
      <div
        v-for="(row, index) in data"
        :key="index"
        class="card cursor-pointer hover:shadow-md transition-shadow"
        @click="emit('row-click', row)"
      >
        <dl class="space-y-2">
          <div v-for="column in columns" :key="String(column.key)" class="flex justify-between">
            <dt class="text-xs font-medium text-gray-500">{{ column.label }}</dt>
            <dd class="text-sm text-gray-900">
              <slot :name="`cell-${String(column.key)}`" :row="row" :value="(row as Record<string, any>)[column.key as string]">
                {{ getCellValue(row, column) }}
              </slot>
            </dd>
          </div>
        </dl>
      </div>
    </template>

    <div v-else class="card text-center py-8">
      <p class="text-sm text-gray-500">No data found</p>
    </div>

    <!-- Mobile pagination -->
    <div v-if="totalItems > 0" class="flex items-center justify-between pt-2">
      <button
        :disabled="page <= 1"
        class="btn-secondary btn-sm"
        @click="emit('update:page', page - 1)"
      >
        Previous
      </button>
      <span class="text-sm text-gray-500">{{ page }} / {{ totalPages }}</span>
      <button
        :disabled="page >= totalPages"
        class="btn-secondary btn-sm"
        @click="emit('update:page', page + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>
