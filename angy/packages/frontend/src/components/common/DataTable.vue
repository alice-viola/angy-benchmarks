<script setup lang="ts" generic="T">
import { ref, computed } from 'vue';
import LoadingSkeleton from './LoadingSkeleton.vue';
import ColumnFilter from './ColumnFilter.vue';
import Pagination from './Pagination.vue';

export interface ColumnDef<R> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (row: R) => string;
}

const props = defineProps<{
  columns: ColumnDef<T>[];
  data: T[];
  loading: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
}>();

const emit = defineEmits<{
  'update:page': [page: number];
  'update:pageSize': [size: number];
  'update:sort': [sort: { field: string; direction: 'asc' | 'desc' | null }];
  'update:filters': [filters: Record<string, string>];
}>();

const sortField = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc' | null>(null);
const filters = ref<Record<string, string>>({});
const selectedRows = ref<Set<number>>(new Set());

const allSelected = computed(
  () => props.data.length > 0 && selectedRows.value.size === props.data.length,
);

function toggleSort(col: ColumnDef<T>) {
  if (!col.sortable) return;

  if (sortField.value !== col.key) {
    sortField.value = col.key;
    sortDirection.value = 'asc';
  } else if (sortDirection.value === 'asc') {
    sortDirection.value = 'desc';
  } else if (sortDirection.value === 'desc') {
    sortField.value = null;
    sortDirection.value = null;
  }

  emit('update:sort', {
    field: sortField.value || col.key,
    direction: sortDirection.value,
  });
}

function onFilterChange(key: string, value: string) {
  filters.value[key] = value;
  emit('update:filters', { ...filters.value });
}

function toggleAll() {
  if (allSelected.value) {
    selectedRows.value.clear();
  } else {
    selectedRows.value = new Set(props.data.map((_, i) => i));
  }
}

function toggleRow(index: number) {
  if (selectedRows.value.has(index)) {
    selectedRows.value.delete(index);
  } else {
    selectedRows.value.add(index);
  }
}

function getCellValue(row: T, col: ColumnDef<T>): string {
  if (col.render) return col.render(row);
  return String((row as Record<string, unknown>)[col.key] ?? '');
}

function getSortIcon(col: ColumnDef<T>): string {
  if (sortField.value !== col.key || !sortDirection.value) return '';
  return sortDirection.value === 'asc' ? ' \u2191' : ' \u2193';
}
</script>

<template>
  <!-- Desktop table -->
  <div class="hidden md:block overflow-x-auto">
    <table class="min-w-full divide-y divide-slate-200">
      <thead class="bg-slate-50">
        <tr>
          <th class="w-10 px-3 py-3">
            <input
              type="checkbox"
              :checked="allSelected"
              class="rounded border-slate-300"
              @change="toggleAll"
            />
          </th>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
            :class="col.sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''"
            @click="toggleSort(col)"
          >
            {{ col.label }}{{ getSortIcon(col) }}
          </th>
        </tr>
        <tr v-if="columns.some((c) => c.filterable)">
          <th class="px-3 py-1" />
          <th v-for="col in columns" :key="col.key" class="px-4 py-1">
            <ColumnFilter
              v-if="col.filterable"
              :model-value="filters[col.key] || ''"
              @filter:change="(val: string) => onFilterChange(col.key, val)"
            />
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-slate-200">
        <template v-if="loading">
          <tr v-for="n in pageSize" :key="n">
            <td class="px-3 py-3"><LoadingSkeleton width="16px" height="16px" /></td>
            <td v-for="col in columns" :key="col.key" class="px-4 py-3">
              <LoadingSkeleton height="14px" />
            </td>
          </tr>
        </template>
        <template v-else-if="data.length === 0">
          <tr>
            <td :colspan="columns.length + 1" class="px-4 py-12 text-center text-slate-500">
              <slot name="empty">No data available.</slot>
            </td>
          </tr>
        </template>
        <template v-else>
          <tr
            v-for="(row, idx) in data"
            :key="idx"
            class="hover:bg-slate-50"
          >
            <td class="px-3 py-3">
              <input
                type="checkbox"
                :checked="selectedRows.has(idx)"
                class="rounded border-slate-300"
                @change="toggleRow(idx)"
              />
            </td>
            <td v-for="col in columns" :key="col.key" class="px-4 py-3 text-sm text-slate-700">
              {{ getCellValue(row, col) }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>

  <!-- Mobile card layout -->
  <div class="md:hidden space-y-3">
    <template v-if="loading">
      <div v-for="n in 3" :key="n" class="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
        <LoadingSkeleton v-for="c in columns" :key="c.key" height="14px" />
      </div>
    </template>
    <template v-else-if="data.length === 0">
      <div class="text-center py-12 text-slate-500">
        <slot name="empty">No data available.</slot>
      </div>
    </template>
    <template v-else>
      <div
        v-for="(row, idx) in data"
        :key="idx"
        class="bg-white rounded-lg border border-slate-200 p-4 space-y-1"
      >
        <div v-for="col in columns" :key="col.key" class="flex justify-between text-sm">
          <span class="font-medium text-slate-500">{{ col.label }}</span>
          <span class="text-slate-700">{{ getCellValue(row, col) }}</span>
        </div>
      </div>
    </template>
  </div>

  <Pagination
    :page="page"
    :page-size="pageSize"
    :total-items="totalItems"
    @update:page="(p) => emit('update:page', p)"
    @update:page-size="(s) => emit('update:pageSize', s)"
  />
</template>
