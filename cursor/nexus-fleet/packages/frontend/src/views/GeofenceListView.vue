<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGeofenceStore } from '../stores/geofences'
import type { GeofenceMapData } from '../components/map/LiveMap.vue'
import { computed } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import LiveMap from '../components/map/LiveMap.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const router = useRouter()
const geofenceStore = useGeofenceStore()

const mapGeofences = computed<GeofenceMapData[]>(() =>
  geofenceStore.geofences.map(g => ({
    id: g.id,
    name: g.name,
    lat: g.lat,
    lng: g.lng,
    radiusM: g.radiusM,
    isActive: g.isActive,
  }))
)

function handleGeofenceClick(id: string) {
  router.push({ name: 'GeofenceEdit', params: { id } })
}

function formatRadius(radiusM: number): string {
  if (radiusM >= 1000) return `${(radiusM / 1000).toFixed(1)} km`
  return `${radiusM} m`
}

onMounted(() => {
  geofenceStore.fetchGeofences()
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Geofences</h1>
          <p class="mt-1 text-sm text-slate-500">
            {{ geofenceStore.geofences.length }} geofences configured
          </p>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          @click="router.push({ name: 'GeofenceCreate' })"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Geofence
        </button>
      </div>

      <!-- Loading -->
      <div v-if="geofenceStore.loading && geofenceStore.geofences.length === 0" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <template v-else>
        <!-- Map showing all geofences -->
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <LiveMap
            :vehicles="[]"
            :geofences="mapGeofences"
            height="400px"
            @geofence-click="handleGeofenceClick"
          />
        </div>

        <!-- Geofence List -->
        <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-100 px-6 py-4">
            <h2 class="text-lg font-semibold text-slate-900">All Geofences</h2>
          </div>
          <div v-if="geofenceStore.geofences.length === 0" class="py-12 text-center text-sm text-slate-400">
            No geofences created yet. Click "Create Geofence" to get started.
          </div>
          <div v-else class="divide-y divide-slate-100">
            <div
              v-for="geofence in geofenceStore.geofences"
              :key="geofence.id"
              class="flex items-center justify-between px-6 py-4 cursor-pointer transition-colors hover:bg-slate-50"
              @click="handleGeofenceClick(geofence.id)"
            >
              <div class="flex items-center gap-4">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg"
                  :class="geofence.isActive ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-400'"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-slate-900">{{ geofence.name }}</p>
                  <p class="text-xs text-slate-500">
                    {{ geofence.lat.toFixed(4) }}, {{ geofence.lng.toFixed(4) }} · Radius: {{ formatRadius(geofence.radiusM) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <StatusBadge :status="geofence.isActive ? 'active' : 'inactive'" />
                <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
