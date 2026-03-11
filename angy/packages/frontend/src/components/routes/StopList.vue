<script setup lang="ts">
import type { RouteStop } from '@/stores/route.store';

const props = defineProps<{
  stops: RouteStop[];
}>();

const emit = defineEmits<{
  'update:stops': [stops: RouteStop[]];
  'remove': [stopId: string];
}>();

function moveUp(index: number) {
  if (index <= 0) return;
  const arr = [...props.stops];
  [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
  arr.forEach((s, i) => s.sequence = i + 1);
  emit('update:stops', arr);
}

function moveDown(index: number) {
  if (index >= props.stops.length - 1) return;
  const arr = [...props.stops];
  [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
  arr.forEach((s, i) => s.sequence = i + 1);
  emit('update:stops', arr);
}

function removeStop(stopId: string) {
  emit('remove', stopId);
}

const stopTypeIcons: Record<string, string> = {
  pickup: 'P',
  delivery: 'D',
  waypoint: 'W',
};
</script>

<template>
  <div class="space-y-2">
    <div v-if="stops.length === 0" class="text-center text-sm text-slate-400 py-8">
      No stops added yet
    </div>
    <div
      v-for="(stop, idx) in stops"
      :key="stop.id"
      class="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
    >
      <span class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
        {{ idx + 1 }}
      </span>
      <span class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-600 text-xs font-bold">
        {{ stopTypeIcons[stop.stop_type] || 'S' }}
      </span>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-slate-900 truncate">{{ stop.address }}</p>
        <p v-if="stop.shipment" class="text-xs text-slate-500">{{ stop.shipment.reference_code }}</p>
      </div>
      <div class="flex gap-1">
        <button class="p-1 text-slate-400 hover:text-slate-600" :disabled="idx === 0" @click="moveUp(idx)">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
        </button>
        <button class="p-1 text-slate-400 hover:text-slate-600" :disabled="idx === stops.length - 1" @click="moveDown(idx)">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <button class="p-1 text-red-400 hover:text-red-600" @click="removeStop(stop.id)">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>
