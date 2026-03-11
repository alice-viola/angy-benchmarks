<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  status: string;
  variant?: 'shipment' | 'vehicle' | 'driver' | 'route';
}>(), {
  variant: undefined,
});

const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  draft:            { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  off_duty:         { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  inactive:         { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },

  confirmed:        { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500' },
  available:        { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500' },
  pending:          { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500' },

  assigned:         { bg: 'bg-indigo-50',   text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  driving:          { bg: 'bg-indigo-50',   text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  active:           { bg: 'bg-indigo-50',   text: 'text-indigo-700',  dot: 'bg-indigo-500' },

  picked_up:        { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
  on_break:         { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },

  in_transit:       { bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500' },
  en_route:         { bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500' },

  delivered:        { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed:        { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },

  failed:           { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },
  maintenance:      { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },
  error:            { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },

  cancelled:        { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-500' },
  decommissioned:   { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-500' },
};

const fallback = { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

const colors = computed(() => {
  const normalized = props.status.toLowerCase().replace(/[\s-]/g, '_');
  return colorMap[normalized] ?? fallback;
});

const displayLabel = computed(() =>
  props.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
);
</script>

<template>
  <span
    :class="[
      'badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      colors.bg,
      colors.text,
    ]"
  >
    <span :class="['h-1.5 w-1.5 shrink-0 rounded-full', colors.dot]" />
    {{ displayLabel }}
  </span>
</template>
