<script setup lang="ts">
import type { Vehicle } from '@nexus-fleet/shared'
import StatusBadge from '../common/StatusBadge.vue'

defineProps<{
  vehicle: Vehicle
}>()

const typeIcons: Record<string, string> = {
  van: '🚐',
  truck: '🚛',
  semi: '🚚',
  refrigerated: '❄️',
}

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ typeIcons[vehicle.type] ?? '🚗' }}</span>
        <div>
          <h3 class="text-sm font-semibold text-gray-900">{{ vehicle.licensePlate }}</h3>
          <p class="text-xs text-gray-500">{{ vehicle.make }} {{ vehicle.model }} ({{ vehicle.year }})</p>
        </div>
      </div>
      <StatusBadge :status="vehicle.status" variant="vehicle" />
    </div>

    <div class="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
      <div>
        <p class="text-xs text-gray-400">Speed</p>
        <p class="text-sm font-medium text-gray-700">
          {{ vehicle.currentSpeed != null ? `${Math.round(vehicle.currentSpeed)} km/h` : '—' }}
        </p>
      </div>
      <div>
        <p class="text-xs text-gray-400">Last Update</p>
        <p class="text-sm font-medium text-gray-700">
          {{ formatTimeAgo(vehicle.lastLocationUpdate) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-gray-400">Capacity</p>
        <p class="text-sm font-medium text-gray-700">{{ vehicle.capacityKg.toLocaleString() }} kg</p>
      </div>
      <div>
        <p class="text-xs text-gray-400">Odometer</p>
        <p class="text-sm font-medium text-gray-700">
          {{ vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString()} km` : '—' }}
        </p>
      </div>
    </div>
  </div>
</template>
