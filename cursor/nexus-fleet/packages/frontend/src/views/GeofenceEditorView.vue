<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGeofenceStore } from '../stores/geofences'
import { useToast } from '../composables/useToast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import AppLayout from '../layouts/AppLayout.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const geofenceStore = useGeofenceStore()
const toast = useToast()

const geofenceId = computed(() => route.params.id as string | undefined)
const isEditing = computed(() => !!geofenceId.value)

const name = ref('')
const description = ref('')
const lat = ref(39.8283)
const lng = ref(-98.5795)
const radiusM = ref(500)
const isActive = ref(true)
const saving = ref(false)

const mapContainer = ref<HTMLDivElement | null>(null)
const map = shallowRef<L.Map | null>(null)
let marker: L.Marker | null = null
let circle: L.Circle | null = null

function initMap() {
  if (!mapContainer.value) return
  const m = L.map(mapContainer.value, {
    center: [lat.value, lng.value],
    zoom: isEditing.value ? 13 : 4,
    zoomControl: true,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(m)

  marker = L.marker([lat.value, lng.value], { draggable: true }).addTo(m)
  circle = L.circle([lat.value, lng.value], {
    radius: radiusM.value,
    color: '#6366f1',
    fillColor: '#6366f1',
    fillOpacity: 0.12,
    weight: 2,
  }).addTo(m)

  marker.on('dragend', () => {
    const pos = marker!.getLatLng()
    lat.value = parseFloat(pos.lat.toFixed(6))
    lng.value = parseFloat(pos.lng.toFixed(6))
    circle?.setLatLng(pos)
  })

  m.on('click', (e: L.LeafletMouseEvent) => {
    lat.value = parseFloat(e.latlng.lat.toFixed(6))
    lng.value = parseFloat(e.latlng.lng.toFixed(6))
    marker?.setLatLng(e.latlng)
    circle?.setLatLng(e.latlng)
  })

  map.value = m
}

function updateCircleRadius() {
  circle?.setRadius(radiusM.value)
}

async function handleSave() {
  if (!name.value.trim()) {
    toast.error('Name is required')
    return
  }
  saving.value = true
  try {
    if (isEditing.value) {
      await geofenceStore.updateGeofence(geofenceId.value!, {
        name: name.value,
        description: description.value || undefined,
        lat: lat.value,
        lng: lng.value,
        radiusM: radiusM.value,
        isActive: isActive.value,
      })
    } else {
      await geofenceStore.createGeofence({
        name: name.value,
        description: description.value || undefined,
        lat: lat.value,
        lng: lng.value,
        radiusM: radiusM.value,
        isActive: isActive.value,
      })
    }
    router.push({ name: 'GeofenceList' })
  } catch {
    toast.error('Failed to save geofence')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (isEditing.value) {
    await geofenceStore.fetchGeofence(geofenceId.value!)
    const g = geofenceStore.currentGeofence
    if (g) {
      name.value = g.name
      description.value = g.description ?? ''
      lat.value = g.lat
      lng.value = g.lng
      radiusM.value = g.radiusM
      isActive.value = g.isActive
    }
  }
  await nextTick()
  initMap()
})

onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button
          class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          @click="router.push({ name: 'GeofenceList' })"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            {{ isEditing ? 'Edit Geofence' : 'Create Geofence' }}
          </h1>
          <p class="text-sm text-slate-500">Click on the map to set the center point</p>
        </div>
      </div>

      <div v-if="geofenceStore.loading && isEditing" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Form -->
        <div class="space-y-6">
          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="mb-4 text-lg font-semibold text-slate-900">Details</h2>
            <div class="space-y-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input
                  v-model="name"
                  type="text"
                  placeholder="e.g. Warehouse Zone A"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  v-model="description"
                  rows="3"
                  placeholder="Optional description..."
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="mb-4 text-lg font-semibold text-slate-900">Location & Trigger</h2>
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-sm font-medium text-slate-700">Latitude</label>
                  <input
                    v-model.number="lat"
                    type="number"
                    step="0.000001"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-slate-700">Longitude</label>
                  <input
                    v-model.number="lng"
                    type="number"
                    step="0.000001"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">
                  Radius: {{ radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)} km` : `${radiusM} m` }}
                </label>
                <input
                  v-model.number="radiusM"
                  type="range"
                  min="50"
                  max="10000"
                  step="50"
                  class="w-full accent-primary-600"
                  @input="updateCircleRadius"
                />
                <div class="flex justify-between text-xs text-slate-400">
                  <span>50 m</span>
                  <span>10 km</span>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <label class="relative inline-flex cursor-pointer items-center">
                  <input v-model="isActive" type="checkbox" class="peer sr-only" />
                  <div class="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
                </label>
                <span class="text-sm font-medium text-slate-700">Active</span>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3">
            <button
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              @click="router.push({ name: 'GeofenceList' })"
            >
              Cancel
            </button>
            <button
              class="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              :disabled="saving || !name.trim()"
              @click="handleSave"
            >
              {{ isEditing ? 'Update Geofence' : 'Create Geofence' }}
            </button>
          </div>
        </div>

        <!-- Map -->
        <div class="sticky top-4">
          <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <div ref="mapContainer" style="height: 560px" />
          </div>
          <p class="mt-2 text-center text-xs text-slate-400">
            Click on the map or drag the marker to set position
          </p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
