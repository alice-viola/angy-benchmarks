<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Package, Plus, Loader2 } from 'lucide-vue-next';
import { useShipmentStore } from '../../stores/shipments';
import type { ShipmentResponse } from '@nexusfleet/shared';

const emit = defineEmits<{
  'add-shipment': [shipment: ShipmentResponse];
}>();

const shipmentStore = useShipmentStore();
const loading = ref(false);
const unassigned = ref<ShipmentResponse[]>([]);

onMounted(async () => {
  loading.value = true;
  try {
    await shipmentStore.list({ status: 'confirmed', page_size: 50 });
    unassigned.value = shipmentStore.shipments.filter((s) => !s.assigned_route_id);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-8">
      <Loader2 class="w-5 h-5 text-neutral-400 animate-spin" />
    </div>

    <div v-else-if="!unassigned.length" class="text-center py-8">
      <Package class="w-8 h-8 text-neutral-300 mx-auto mb-2" />
      <p class="text-sm text-neutral-400">No unassigned shipments</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="shipment in unassigned"
        :key="shipment.id"
        class="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 hover:border-accent-300 hover:bg-accent-50/30 transition-colors"
      >
        <div class="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center flex-shrink-0">
          <Package class="w-4 h-4 text-accent-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-neutral-700 truncate">
            {{ shipment.reference_code || 'Draft' }}
          </p>
          <p class="text-xs text-neutral-400 truncate">{{ shipment.dest_address }}</p>
        </div>
        <button
          class="w-7 h-7 rounded-md bg-accent-500 hover:bg-accent-600 text-white flex items-center justify-center flex-shrink-0 transition-colors"
          title="Add to route"
          @click="emit('add-shipment', shipment)"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
