<script setup lang="ts">
const props = defineProps<{ status: string }>();

const colorMap: Record<string, string> = {
  // Shipment
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  picked_up: 'bg-purple-100 text-purple-700',
  in_transit: 'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-500',
  // Vehicle (available reuses shipment color above)
  idle: 'bg-gray-100 text-gray-700',
  maintenance: 'bg-orange-100 text-orange-700',
  decommissioned: 'bg-gray-200 text-gray-500',
  // Driver
  driving: 'bg-blue-100 text-blue-700',
  off_duty: 'bg-gray-100 text-gray-700',
  on_break: 'bg-yellow-100 text-yellow-700',
};

function getColor(s: string) {
  return colorMap[s] || 'bg-gray-100 text-gray-700';
}

function formatLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
</script>

<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    :class="getColor(props.status)"
  >
    {{ formatLabel(props.status) }}
  </span>
</template>
