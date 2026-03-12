<script setup lang="ts">
import { computed } from 'vue';
import type { ConnectionStatus as ConnectionStatusType } from '../../composables/useWebSocket';

const props = defineProps<{
  status: ConnectionStatusType;
}>();

const dotClass = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'bg-success-500';
    case 'reconnecting':
      return 'bg-accent-400 animate-pulse';
    case 'disconnected':
      return 'bg-danger-500';
    default:
      return 'bg-neutral-400';
  }
});

const label = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
});
</script>

<template>
  <div class="flex items-center gap-1.5" :title="label">
    <span :class="['w-2.5 h-2.5 rounded-full', dotClass]" />
  </div>
</template>
