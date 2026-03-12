<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: string;
  type?: 'shipment' | 'vehicle' | 'driver' | 'route';
}>();

const colorMap: Record<string, string> = {
  // Shipment statuses
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  picked_up: 'bg-purple-100 text-purple-700',
  in_transit: 'bg-accent-100 text-accent-700',
  delivered: 'bg-success-100 text-success-700',
  completed: 'bg-success-100 text-success-700',
  failed: 'bg-danger-100 text-danger-700',
  cancelled: 'bg-gray-100 text-gray-500',

  // Vehicle statuses
  available: 'bg-success-100 text-success-700',
  idle: 'bg-accent-100 text-accent-700',
  maintenance: 'bg-warning-100 text-warning-700',
  decommissioned: 'bg-gray-100 text-gray-500',

  // Driver statuses
  off_duty: 'bg-gray-100 text-gray-700',
  driving: 'bg-blue-100 text-blue-700',
  on_break: 'bg-accent-100 text-accent-700',

  // Route statuses
  optimized: 'bg-purple-100 text-purple-700',
  active: 'bg-success-100 text-success-700',

  // Priorities
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-warning-100 text-warning-700',
  critical: 'bg-danger-100 text-danger-700',
};

const classes = computed(() => {
  return colorMap[props.status] || 'bg-gray-100 text-gray-700';
});

const label = computed(() => {
  return props.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      classes,
    ]"
  >
    {{ label }}
  </span>
</template>
