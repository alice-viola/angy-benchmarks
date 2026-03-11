<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useDriverStore } from '@/stores/driver.store';

const route = useRoute();
const store = useDriverStore();
const id = route.params.id as string;

onMounted(() => {
  store.fetchOne(id);
});

const hosPercentage = computed(() => {
  if (!store.currentDriver || !store.currentDriver.max_driving_hours_day) return 0;
  return Math.round((store.currentDriver.current_driving_hours / store.currentDriver.max_driving_hours_day) * 100);
});

const hosColor = computed(() => {
  if (hosPercentage.value > 80) return 'bg-red-500';
  if (hosPercentage.value > 60) return 'bg-yellow-500';
  return 'bg-green-500';
});

const licenseExpiryWarning = computed(() => {
  if (!store.currentDriver?.license_expiry) return false;
  const expiry = new Date(store.currentDriver.license_expiry);
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return expiry.getTime() - Date.now() < thirtyDays;
});
</script>

<template>
  <div v-if="store.currentDriver">
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-slate-900">
        {{ store.currentDriver.first_name }} {{ store.currentDriver.last_name }}
      </h1>
      <StatusBadge :status="store.currentDriver.status" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Info -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">Driver Details</h3>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Email</dt>
            <dd class="text-slate-900">{{ store.currentDriver.email }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Phone</dt>
            <dd class="text-slate-900">{{ store.currentDriver.phone }}</dd>
          </div>
        </dl>
      </div>

      <!-- License -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">License Info</h3>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">License #</dt>
            <dd class="text-slate-900">{{ store.currentDriver.license_number }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Class</dt>
            <dd class="text-slate-900">{{ store.currentDriver.license_class }}</dd>
          </div>
          <div v-if="store.currentDriver.license_expiry" class="flex justify-between">
            <dt class="text-slate-500">Expiry</dt>
            <dd :class="licenseExpiryWarning ? 'text-red-600 font-medium' : 'text-slate-900'">
              {{ new Date(store.currentDriver.license_expiry).toLocaleDateString() }}
              <span v-if="licenseExpiryWarning" class="text-xs">(expiring soon)</span>
            </dd>
          </div>
        </dl>
      </div>

      <!-- HoS -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">Hours of Service</h3>
        <div class="text-sm text-slate-600 mb-2">
          {{ store.currentDriver.current_driving_hours }}h / {{ store.currentDriver.max_driving_hours_day }}h
        </div>
        <div class="w-full bg-slate-200 rounded-full h-3">
          <div class="h-3 rounded-full transition-all" :class="hosColor"
            :style="{ width: `${Math.min(hosPercentage, 100)}%` }" />
        </div>
        <p v-if="hosPercentage > 80" class="mt-1 text-xs text-red-600">Approaching daily limit</p>
      </div>

      <!-- Vehicle -->
      <div class="bg-white rounded-lg border border-slate-200 p-4">
        <h3 class="text-sm font-medium text-slate-500 mb-3">Assigned Vehicle</h3>
        <div v-if="store.currentDriver.vehicle" class="text-sm">
          <p class="text-slate-900 font-medium">{{ store.currentDriver.vehicle.registration }}</p>
          <p class="text-slate-600">{{ store.currentDriver.vehicle.make }} {{ store.currentDriver.vehicle.model }}</p>
        </div>
        <p v-else class="text-sm text-slate-400">No vehicle assigned</p>
      </div>
    </div>
  </div>
  <div v-else-if="store.loading" class="animate-pulse space-y-4">
    <div class="h-8 bg-slate-200 rounded w-1/3"></div>
    <div class="h-64 bg-slate-200 rounded"></div>
  </div>
</template>
