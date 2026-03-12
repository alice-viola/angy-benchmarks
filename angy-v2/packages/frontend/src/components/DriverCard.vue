<script setup lang="ts">
import { computed } from 'vue';
import { Phone, CreditCard, Clock, ChevronRight } from 'lucide-vue-next';
import StatusBadge from './common/StatusBadge.vue';
import type { DriverResponse } from '@nexusfleet/shared';

const props = defineProps<{
  driver: DriverResponse;
}>();

const emit = defineEmits<{
  click: [driver: DriverResponse];
}>();

const fullName = computed(
  () => `${props.driver.first_name} ${props.driver.last_name}`
);

const hoursDisplay = computed(() => {
  const current = props.driver.current_driving_hours;
  const max = props.driver.max_driving_hours_day;
  return `${current.toFixed(1)} / ${max.toFixed(1)} hrs`;
});

const hoursPercent = computed(() => {
  const pct =
    (props.driver.current_driving_hours / props.driver.max_driving_hours_day) * 100;
  return Math.min(pct, 100);
});

const hoursBarColor = computed(() => {
  if (hoursPercent.value >= 90) return 'bg-danger-500';
  if (hoursPercent.value >= 70) return 'bg-warning-500';
  return 'bg-success-500';
});

const licenseExpiryWarning = computed(() => {
  const expiry = new Date(props.driver.license_expiry);
  const now = new Date();
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Expired';
  if (diffDays < 30) return `Expires in ${diffDays}d`;
  return null;
});
</script>

<template>
  <div
    class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer group"
    @click="emit('click', driver)"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center">
          {{ driver.first_name[0] }}{{ driver.last_name[0] }}
        </div>
        <div>
          <h3 class="text-sm font-medium text-neutral-800">{{ fullName }}</h3>
          <p class="text-xs text-neutral-400 font-mono">{{ driver.employee_id }}</p>
        </div>
      </div>
      <StatusBadge :status="driver.status" />
    </div>

    <div class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-neutral-500">
        <Phone class="w-3.5 h-3.5 text-neutral-400" />
        <span>{{ driver.phone }}</span>
      </div>

      <div class="flex items-center gap-2 text-xs text-neutral-500">
        <CreditCard class="w-3.5 h-3.5 text-neutral-400" />
        <span>License: {{ driver.license_classes.join(', ') }}</span>
        <span
          v-if="licenseExpiryWarning"
          class="text-xs font-medium"
          :class="licenseExpiryWarning === 'Expired' ? 'text-danger-500' : 'text-warning-600'"
        >
          · {{ licenseExpiryWarning }}
        </span>
      </div>

      <div class="flex items-center gap-2 text-xs text-neutral-500">
        <Clock class="w-3.5 h-3.5 text-neutral-400" />
        <span>{{ hoursDisplay }}</span>
      </div>

      <!-- Hours progress bar -->
      <div class="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div
          :class="['h-full rounded-full transition-all duration-300', hoursBarColor]"
          :style="{ width: `${hoursPercent}%` }"
        />
      </div>
    </div>

    <div class="flex items-center justify-end mt-3 pt-3 border-t border-neutral-100">
      <ChevronRight class="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
    </div>
  </div>
</template>
