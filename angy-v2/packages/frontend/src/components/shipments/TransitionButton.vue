<script setup lang="ts">
import { ref, computed } from 'vue';
import { useShipmentStore } from '../../stores/shipments';
import { useToast } from '../../composables/useToast';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  Truck,
  Package,
  Ban,
  UserCheck,
  Loader2,
} from 'lucide-vue-next';

const props = defineProps<{
  shipmentId: string;
  status: string;
}>();

const emit = defineEmits<{
  transitioned: [action: string];
}>();

const shipmentStore = useShipmentStore();
const { addToast } = useToast();
const transitioning = ref(false);

interface TransitionConfig {
  action: string;
  label: string;
  icon: typeof CheckCircle;
  classes: string;
}

const availableTransitions = computed<TransitionConfig[]>(() => {
  const map: Record<string, TransitionConfig[]> = {
    draft: [
      { action: 'confirm', label: 'Confirm', icon: CheckCircle, classes: 'bg-info-500 hover:bg-info-600 text-white' },
      { action: 'cancel', label: 'Cancel', icon: Ban, classes: 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700' },
    ],
    confirmed: [
      { action: 'assign', label: 'Assign', icon: UserCheck, classes: 'bg-primary-500 hover:bg-primary-600 text-white' },
      { action: 'cancel', label: 'Cancel', icon: Ban, classes: 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700' },
    ],
    assigned: [
      { action: 'pickup', label: 'Pick Up', icon: Package, classes: 'bg-accent-500 hover:bg-accent-600 text-white' },
      { action: 'cancel', label: 'Cancel', icon: Ban, classes: 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700' },
    ],
    picked_up: [
      { action: 'pickup', label: 'In Transit', icon: Truck, classes: 'bg-accent-500 hover:bg-accent-600 text-white' },
    ],
    in_transit: [
      { action: 'deliver', label: 'Deliver', icon: CheckCircle, classes: 'bg-success-500 hover:bg-success-600 text-white' },
      { action: 'fail', label: 'Mark Failed', icon: XCircle, classes: 'bg-danger-500 hover:bg-danger-600 text-white' },
    ],
    delivered: [
      { action: 'complete', label: 'Complete', icon: CheckCircle, classes: 'bg-success-500 hover:bg-success-600 text-white' },
    ],
    failed: [
      { action: 'retry', label: 'Retry', icon: RotateCcw, classes: 'bg-warning-500 hover:bg-warning-600 text-white' },
    ],
  };
  return map[props.status] || [];
});

async function handleTransition(action: string) {
  transitioning.value = true;
  try {
    await shipmentStore.transition(props.shipmentId, action);
    addToast({ type: 'success', title: `Shipment ${action} successful` });
    emit('transitioned', action);
  } catch {
    addToast({ type: 'error', title: `Failed to ${action} shipment` });
  } finally {
    transitioning.value = false;
  }
}
</script>

<template>
  <div v-if="availableTransitions.length" class="flex flex-wrap gap-2">
    <button
      v-for="t in availableTransitions"
      :key="t.action"
      :disabled="transitioning"
      :class="[
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        t.classes,
      ]"
      @click="handleTransition(t.action)"
    >
      <Loader2 v-if="transitioning" class="w-4 h-4 animate-spin" />
      <component :is="t.icon" v-else class="w-4 h-4" />
      {{ t.label }}
    </button>
  </div>
</template>
