<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDriversStore } from '@/stores/drivers';
import AppLayout from '@/layouts/AppLayout.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

const route = useRoute();
const router = useRouter();
const driversStore = useDriversStore();

const driverId = route.params.id as string;
const driver = computed(() => driversStore.currentDriver);

const isLicenseExpiringSoon = computed(() => {
  if (!driver.value) return false;
  const expiry = new Date(driver.value.license_expiry);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return expiry <= thirtyDaysFromNow;
});

onMounted(() => {
  driversStore.fetchDriver(driverId);
});
</script>

<template>
  <AppLayout>
    <div v-if="driversStore.loading && !driver" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="driver" class="space-y-6">
      <div class="page-header">
        <div class="flex items-center gap-3">
          <button class="p-1 text-gray-400 hover:text-gray-600" @click="router.back()">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 class="page-title">{{ driver.first_name }} {{ driver.last_name }}</h1>
            <p class="text-sm text-gray-500">Employee ID: {{ driver.employee_id }}</p>
          </div>
        </div>
        <StatusBadge :status="driver.status" type="driver" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Contact -->
        <div class="card">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Contact Information</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">Phone</dt>
              <dd class="text-gray-900">{{ driver.phone }}</dd>
            </div>
          </dl>
        </div>

        <!-- License -->
        <div class="card">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">License Information</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">License Number</dt>
              <dd class="font-mono text-gray-900">{{ driver.license_number }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">License Classes</dt>
              <dd class="text-gray-900">
                <span
                  v-for="cls in driver.license_classes"
                  :key="cls"
                  class="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 mr-1"
                >
                  {{ cls }}
                </span>
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">Expiry</dt>
              <dd :class="[isLicenseExpiringSoon ? 'text-danger-600 font-medium' : 'text-gray-900']">
                {{ new Date(driver.license_expiry).toLocaleDateString() }}
                <span v-if="isLicenseExpiringSoon" class="ml-1 text-xs">(Expiring soon)</span>
              </dd>
            </div>
          </dl>
        </div>

        <!-- Driving hours -->
        <div class="card">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Driving Hours</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">Max Daily Hours</dt>
              <dd class="text-gray-900">{{ driver.max_driving_hours_day }}h</dd>
            </div>
            <div>
              <dt class="text-gray-500 mb-1">Current Vehicle</dt>
              <dd class="text-gray-900">
                {{ driver.current_vehicle_id ? driver.current_vehicle_id.slice(0, 8) + '...' : 'None assigned' }}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
