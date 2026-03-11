<script setup lang="ts" generic="T">
import { ref, computed, watch } from 'vue';

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (row: T) => any;
  width?: string;
}

const props = withDefaults(defineProps<{
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  totalItems?: number;
  page?: number;
  pageSize?: number;
}>(), {
  loading: false,
  totalItems: 0,
  page: 1,
  pageSize: 10,
});

const emit = defineEmits<{
  'update:page': [page: number];
  'update:pageSize': [size: number];
  'update:sort': [payload: { key: string; direction: 'asc' | 'desc' | null }];
  'update:filters': [filters: Record<string, string>];
}>();

const sortKey = ref<string | null>(null);
const sortDir = ref<'asc' | 'desc' | null>(null);
const filters = ref<Record<string, string>>({});
const selectedRows = ref<Set<number>>(new Set());
const filterTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({});
const isMobile = ref(false);

function checkMobile() {
  isMobile.value = window.innerWidth < 768;
}

if (typeof window !== 'undefined') {
  checkMobile();
  window.addEventListener('resize', checkMobile);
}

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)));

const pageNumbers = computed(() => {
  const pages: (number | '...')[] = [];
  const total = totalPages.value;
  const current = props.page;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }

  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
});

const allSelected = computed(() =>
  props.data.length > 0 && selectedRows.value.size === props.data.length
);

function toggleSort(key: string) {
  if (sortKey.value === key) {
    if (sortDir.value === 'asc') {
      sortDir.value = 'desc';
    } else if (sortDir.value === 'desc') {
      sortKey.value = null;
      sortDir.value = null;
    }
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
  emit('update:sort', { key, direction: sortDir.value });
}

function handleFilterInput(key: string, value: string) {
  if (filterTimers.value[key]) clearTimeout(filterTimers.value[key]);
  filterTimers.value[key] = setTimeout(() => {
    filters.value[key] = value;
    emit('update:filters', { ...filters.value });
  }, 300);
}

function toggleSelectAll() {
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

function getCellValue(row: T, col: ColumnDef<T>) {
  if (col.render) return col.render(row);
  return (row as Record<string, unknown>)[col.key];
}

function goToPage(p: number) {
  if (p >= 1 && p <= totalPages.value) emit('update:page', p);
}

function changePageSize(e: Event) {
  const size = Number((e.target as HTMLSelectElement).value);
  emit('update:pageSize', size);
  emit('update:page', 1);
}

watch(() => props.data, () => {
  selectedRows.value.clear();
});

defineExpose({ selectedRows });
</script>

<template>
  <div class="w-full">
    <!-- Desktop table view -->
    <div v-if="!isMobile" class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50">
            <!-- Checkbox column -->
            <th class="w-12 px-4 py-3">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="selectedRows.size > 0 && !allSelected"
                class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                @change="toggleSelectAll"
              />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              :style="col.width ? { width: col.width } : {}"
              class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              <div class="flex flex-col gap-1.5">
                <button
                  v-if="col.sortable"
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="toggleSort(col.key)"
                >
                  {{ col.label }}
                  <span class="inline-flex flex-col text-[10px] leading-none">
                    <span :class="sortKey === col.key && sortDir === 'asc' ? 'text-primary-600' : 'text-slate-300'">▲</span>
                    <span :class="sortKey === col.key && sortDir === 'desc' ? 'text-primary-600' : 'text-slate-300'">▼</span>
                  </span>
                </button>
                <span v-else>{{ col.label }}</span>

                <input
                  v-if="col.filterable"
                  type="text"
                  :placeholder="`Filter ${col.label.toLowerCase()}…`"
                  class="w-full rounded border border-slate-200 px-2 py-1 text-xs font-normal normal-case text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
                  @input="handleFilterInput(col.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </th>
          </tr>
        </thead>

        <!-- Loading skeleton -->
        <tbody v-if="loading">
          <tr v-for="r in pageSize" :key="r" class="border-b border-slate-100">
            <td class="px-4 py-3">
              <div class="h-4 w-4 animate-pulse rounded bg-slate-200" />
            </td>
            <td v-for="col in columns" :key="col.key" class="px-4 py-3">
              <div class="h-4 animate-pulse rounded bg-slate-200" :style="{ width: `${60 + Math.random() * 30}%` }" />
            </td>
          </tr>
        </tbody>

        <!-- Empty state -->
        <tbody v-else-if="data.length === 0">
          <tr>
            <td :colspan="columns.length + 1" class="px-4 py-16 text-center">
              <div class="flex flex-col items-center gap-2">
                <svg class="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p class="text-sm font-medium text-slate-500">No data found</p>
                <p class="text-xs text-slate-400">Try adjusting your search or filters</p>
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Data rows -->
        <tbody v-else>
          <tr
            v-for="(row, idx) in data"
            :key="idx"
            :class="[
              'border-b border-slate-100 transition-colors',
              selectedRows.has(idx) ? 'bg-primary-50/50' : 'hover:bg-slate-50',
            ]"
          >
            <td class="px-4 py-3">
              <input
                type="checkbox"
                :checked="selectedRows.has(idx)"
                class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                @change="toggleRow(idx)"
              />
            </td>
            <td v-for="col in columns" :key="col.key" class="px-4 py-3 text-slate-700">
              <slot :name="`cell-${col.key}`" :row="row" :value="getCellValue(row, col)">
                {{ getCellValue(row, col) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile card view -->
    <div v-else class="space-y-3">
      <!-- Loading skeleton cards -->
      <template v-if="loading">
        <div v-for="r in pageSize" :key="r" class="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div v-for="col in columns" :key="col.key" class="flex items-center justify-between">
            <div class="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div class="h-3 animate-pulse rounded bg-slate-200" :style="{ width: `${40 + Math.random() * 30}%` }" />
          </div>
        </div>
      </template>

      <!-- Empty state card -->
      <div v-else-if="data.length === 0" class="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center">
        <svg class="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p class="mt-2 text-sm font-medium text-slate-500">No data found</p>
      </div>

      <!-- Data cards -->
      <template v-else>
        <div
          v-for="(row, idx) in data"
          :key="idx"
          :class="[
            'rounded-xl border bg-white p-4 transition-colors',
            selectedRows.has(idx) ? 'border-primary-300 bg-primary-50/30' : 'border-slate-200',
          ]"
        >
          <div class="mb-3 flex items-center justify-between">
            <input
              type="checkbox"
              :checked="selectedRows.has(idx)"
              class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              @change="toggleRow(idx)"
            />
            <span class="text-xs text-slate-400">#{{ (page - 1) * pageSize + idx + 1 }}</span>
          </div>
          <dl class="space-y-2">
            <div v-for="col in columns" :key="col.key" class="flex items-start justify-between gap-4">
              <dt class="shrink-0 text-xs font-medium uppercase tracking-wider text-slate-400">
                {{ col.label }}
              </dt>
              <dd class="text-right text-sm text-slate-700">
                <slot :name="`cell-${col.key}`" :row="row" :value="getCellValue(row, col)">
                  {{ getCellValue(row, col) }}
                </slot>
              </dd>
            </div>
          </dl>
        </div>
      </template>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalItems > 0"
      class="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <span>Showing {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, totalItems) }} of {{ totalItems }}</span>
        <select
          :value="pageSize"
          class="rounded-lg border border-slate-300 bg-white py-1 pl-2 pr-7 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          @change="changePageSize"
        >
          <option v-for="s in [10, 25, 50, 100]" :key="s" :value="s">{{ s }} / page</option>
        </select>
      </div>

      <nav class="flex items-center gap-1">
        <button
          :disabled="page <= 1"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          @click="goToPage(page - 1)"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <template v-for="(p, i) in pageNumbers" :key="i">
          <span v-if="p === '...'" class="px-1 text-slate-400">…</span>
          <button
            v-else
            :class="[
              'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg text-sm font-medium transition-colors',
              p === page
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100',
            ]"
            @click="goToPage(p as number)"
          >
            {{ p }}
          </button>
        </template>

        <button
          :disabled="page >= totalPages"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          @click="goToPage(page + 1)"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </nav>
    </div>
  </div>
</template>
