<script setup lang="ts">
import { computed } from 'vue';
import { Truck, Users, Package, CheckCircle } from 'lucide-vue-next';
import LoadingSkeleton from '../common/LoadingSkeleton.vue';

interface FleetStats {
  vehicles: { total: number; active: number; available: number; in_transit: number; maintenance: number };
  drivers: { total: number; on_duty: number; off_duty: number; driving: number };
  shipments: { active: number; delivered_today: number; by_status: Record<string, number> };
}

const props = defineProps<{
  stats: FleetStats | null;
  loading?: boolean;
}>();

const cards = computed(() => [
  {
    label: 'Total Vehicles',
    value: props.stats?.vehicles.total ?? 0,
    subtitle: `${props.stats?.vehicles.available ?? 0} available`,
    icon: Truck,
    color: 'primary',
    borderClass: 'border-l-primary-500',
    iconBg: 'bg-primary-50 text-primary-500',
  },
  {
    label: 'Active Drivers',
    value: props.stats?.drivers.on_duty ?? 0,
    subtitle: `${props.stats?.drivers.total ?? 0} total`,
    icon: Users,
    color: 'success',
    borderClass: 'border-l-success-500',
    iconBg: 'bg-success-50 text-success-500',
  },
  {
    label: 'Active Shipments',
    value: props.stats?.shipments.active ?? 0,
    subtitle: 'In progress',
    icon: Package,
    color: 'accent',
    borderClass: 'border-l-accent-500',
    iconBg: 'bg-accent-50 text-accent-500',
  },
  {
    label: 'Delivered Today',
    value: props.stats?.shipments.delivered_today ?? 0,
    subtitle: 'Completed deliveries',
    icon: CheckCircle,
    color: 'success',
    borderClass: 'border-l-success-500',
    iconBg: 'bg-success-50 text-success-500',
  },
]);
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div
      v-for="card in cards"
      :key="card.label"
      :class="[
        'bg-white rounded-xl border border-neutral-200 shadow-sm p-5 border-l-4',
        card.borderClass,
      ]"
    >
      <template v-if="loading">
        <LoadingSkeleton width="70%" height="12px" class="mb-3" />
        <LoadingSkeleton width="40%" height="28px" class="mb-2" />
        <LoadingSkeleton width="50%" height="10px" />
      </template>
      <template v-else>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            {{ card.label }}
          </span>
          <div :class="['w-10 h-10 rounded-xl flex items-center justify-center', card.iconBg]">
            <component :is="card.icon" class="w-5 h-5" />
          </div>
        </div>
        <p class="text-2xl font-bold text-neutral-800">{{ card.value }}</p>
        <p class="text-xs text-neutral-400 mt-1">{{ card.subtitle }}</p>
      </template>
    </div>
  </div>
</template>
