<script setup lang="ts">
import { computed } from 'vue';
import { CheckCheck, XCircle, Ban } from 'lucide-vue-next';

const props = defineProps<{
  status: string;
}>();

const config = computed(() => {
  const map: Record<string, { bg: string; text: string; dot?: string; icon?: typeof CheckCheck; pulse?: boolean }> = {
    draft: { bg: 'bg-neutral-100', text: 'text-neutral-600', dot: 'bg-neutral-400' },
    confirmed: { bg: 'bg-info-50', text: 'text-info-700', dot: 'bg-info-500' },
    assigned: { bg: 'bg-primary-50', text: 'text-primary-700', dot: 'bg-primary-500' },
    picked_up: { bg: 'bg-accent-50', text: 'text-accent-700', dot: 'bg-accent-500' },
    in_transit: { bg: 'bg-accent-100', text: 'text-accent-800', dot: 'bg-accent-500', pulse: true },
    delivered: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
    completed: { bg: 'bg-success-100', text: 'text-success-800', icon: CheckCheck },
    failed: { bg: 'bg-danger-50', text: 'text-danger-700', icon: XCircle },
    cancelled: { bg: 'bg-neutral-100', text: 'text-neutral-500', icon: Ban },
    // Vehicle statuses
    available: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
    maintenance: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
    decommissioned: { bg: 'bg-neutral-100', text: 'text-neutral-500', dot: 'bg-neutral-400' },
    // Driver statuses
    off_duty: { bg: 'bg-neutral-100', text: 'text-neutral-600', dot: 'bg-neutral-400' },
    driving: { bg: 'bg-accent-100', text: 'text-accent-800', dot: 'bg-accent-500', pulse: true },
    resting: { bg: 'bg-info-50', text: 'text-info-700', dot: 'bg-info-500' },
    // Route statuses
    active: { bg: 'bg-accent-100', text: 'text-accent-800', dot: 'bg-accent-500' },
    // Generic
    on_duty: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
  };
  return map[props.status] || { bg: 'bg-neutral-100', text: 'text-neutral-600', dot: 'bg-neutral-400' };
});

const displayLabel = computed(() => {
  return props.status.replace(/_/g, ' ');
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize',
      config.bg,
      config.text,
    ]"
  >
    <component
      v-if="config.icon"
      :is="config.icon"
      class="w-3.5 h-3.5"
    />
    <span
      v-else-if="config.dot"
      :class="[
        'w-1.5 h-1.5 rounded-full',
        config.dot,
        config.pulse ? 'animate-pulse-subtle' : '',
      ]"
    />
    {{ displayLabel }}
  </span>
</template>
