<script setup lang="ts">
import type { Driver } from '@nexus-fleet/shared'
import StatusBadge from '../common/StatusBadge.vue'

defineProps<{
  driver: Driver
}>()

const MAX_DAILY_HOURS = 11
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
          {{ driver.firstName.charAt(0) }}{{ driver.lastName.charAt(0) }}
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-900">{{ driver.firstName }} {{ driver.lastName }}</h3>
          <p class="text-xs text-gray-500">License: {{ driver.licenseNumber }}</p>
        </div>
      </div>
      <StatusBadge :status="driver.status" variant="driver" />
    </div>

    <div class="mt-3 border-t border-gray-100 pt-3">
      <div class="mb-3 grid grid-cols-2 gap-3">
        <div>
          <p class="text-xs text-gray-400">License Class</p>
          <div class="mt-0.5 flex gap-1">
            <span
              v-for="cls in driver.licenseClass.split(',')"
              :key="cls"
              class="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700"
            >
              {{ cls.trim() }}
            </span>
          </div>
        </div>
        <div>
          <p class="text-xs text-gray-400">License Expiry</p>
          <p class="mt-0.5 text-sm font-medium text-gray-700">
            {{ new Date(driver.licenseExpiry).toLocaleDateString() }}
          </p>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-400">Driving Hours (est.)</span>
          <span class="font-medium text-gray-600">
            {{ driver.status === 'driving' ? '~6' : '0' }} / {{ MAX_DAILY_HOURS }}h
          </span>
        </div>
        <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            class="h-full rounded-full transition-all"
            :class="driver.status === 'driving' ? 'bg-blue-500' : 'bg-gray-300'"
            :style="{ width: driver.status === 'driving' ? '55%' : '0%' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
