<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick, shallowRef } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

export interface VehicleMapData {
  id: string
  lat: number
  lng: number
  heading: number
  speed?: number
  licensePlate: string
  status: string
  make?: string
  model?: string
  type?: string
}

export interface GeofenceMapData {
  id: string
  name: string
  lat: number
  lng: number
  radiusM: number
  isActive?: boolean
}

export interface RoutePolyline {
  id: string
  points: { lat: number; lng: number }[]
  color?: string
}

const props = withDefaults(
  defineProps<{
    vehicles: VehicleMapData[]
    geofences?: GeofenceMapData[]
    routes?: RoutePolyline[]
    height?: string
  }>(),
  {
    geofences: () => [],
    routes: () => [],
    height: '500px',
  },
)

const emit = defineEmits<{
  vehicleClick: [vehicleId: string]
  geofenceClick: [geofenceId: string]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
const map = shallowRef<L.Map | null>(null)
const trackedVehicleId = ref<string | null>(null)

const vehicleMarkers = new Map<string, L.Marker>()
const geofenceCircles = new Map<string, L.Circle>()
const routePolylines = new Map<string, L.Polyline>()
let clusterGroup: L.MarkerClusterGroup | null = null
let usesClustering = false

const ROUTE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444']

function createTruckIcon(heading: number, status: string): L.DivIcon {
  const statusColor: Record<string, string> = {
    available: '#10b981',
    in_transit: '#3b82f6',
    idle: '#f59e0b',
    maintenance: '#f97316',
    decommissioned: '#6b7280',
  }
  const color = statusColor[status] ?? '#6b7280'

  return L.divIcon({
    className: 'vehicle-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
    html: `
      <div style="transform: rotate(${heading}deg); width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM6 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="${color}"/>
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2a3 3 0 006 0h6a3 3 0 006 0h2v-5l-3-4zm-.5 1.5l1.96 2.5H17V9.5h2.5z" fill="${color}"/>
          <circle cx="12" cy="4" r="3" fill="${color}" opacity="0.3"/>
          <polygon points="12,1 14,5 10,5" fill="white" opacity="0.8"/>
        </svg>
      </div>
    `,
  })
}

function createPopupContent(v: VehicleMapData): string {
  return `
    <div style="min-width:180px;font-family:system-ui,sans-serif;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${v.licensePlate}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">
        ${v.make ?? ''} ${v.model ?? ''} &middot; ${v.type ?? 'vehicle'}
      </div>
      <div style="display:flex;gap:12px;font-size:12px;margin-bottom:8px;">
        <span><b>Status:</b> ${v.status.replace(/_/g, ' ')}</span>
        <span><b>Speed:</b> ${v.speed != null ? Math.round(v.speed) + ' km/h' : '—'}</span>
      </div>
      <button
        onclick="document.dispatchEvent(new CustomEvent('livemap:track',{detail:'${v.id}'}))"
        style="width:100%;padding:6px 0;background:#4f46e5;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;"
      >
        Track Vehicle
      </button>
    </div>
  `
}

function initMap() {
  if (!mapContainer.value) return
  const m = L.map(mapContainer.value, {
    center: [39.8283, -98.5795],
    zoom: 4,
    zoomControl: true,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(m)

  map.value = m
}

function setupClustering() {
  if (!map.value) return
  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  })
  map.value.addLayer(clusterGroup)
  usesClustering = true
}

function teardownClustering() {
  if (clusterGroup && map.value) {
    map.value.removeLayer(clusterGroup)
    clusterGroup = null
    usesClustering = false
  }
}

function addMarkerToMap(marker: L.Marker) {
  if (usesClustering && clusterGroup) {
    clusterGroup.addLayer(marker)
  } else {
    marker.addTo(map.value!)
  }
}

function removeMarkerFromMap(marker: L.Marker) {
  if (usesClustering && clusterGroup) {
    clusterGroup.removeLayer(marker)
  } else {
    marker.removeFrom(map.value!)
  }
}

function syncVehicles() {
  if (!map.value) return

  const shouldCluster = props.vehicles.length > 50
  if (shouldCluster && !usesClustering) {
    vehicleMarkers.forEach((m) => m.removeFrom(map.value!))
    setupClustering()
    vehicleMarkers.forEach((m) => clusterGroup!.addLayer(m))
  } else if (!shouldCluster && usesClustering) {
    teardownClustering()
    vehicleMarkers.forEach((m) => m.addTo(map.value!))
  }

  const currentIds = new Set(props.vehicles.map((v) => v.id))

  for (const [id, marker] of vehicleMarkers) {
    if (!currentIds.has(id)) {
      removeMarkerFromMap(marker)
      vehicleMarkers.delete(id)
    }
  }

  for (const v of props.vehicles) {
    const existing = vehicleMarkers.get(v.id)
    if (existing) {
      existing.setLatLng([v.lat, v.lng])
      existing.setIcon(createTruckIcon(v.heading, v.status))
      existing.setPopupContent(createPopupContent(v))
    } else {
      const marker = L.marker([v.lat, v.lng], {
        icon: createTruckIcon(v.heading, v.status),
      })
      marker.bindPopup(createPopupContent(v))
      marker.on('click', () => emit('vehicleClick', v.id))
      addMarkerToMap(marker)
      vehicleMarkers.set(v.id, marker)
    }
  }

  if (trackedVehicleId.value) {
    const tracked = props.vehicles.find((v) => v.id === trackedVehicleId.value)
    if (tracked) {
      map.value.panTo([tracked.lat, tracked.lng], { animate: true })
    }
  }
}

function syncGeofences() {
  if (!map.value) return

  const currentIds = new Set((props.geofences ?? []).map((g) => g.id))

  for (const [id, circle] of geofenceCircles) {
    if (!currentIds.has(id)) {
      circle.removeFrom(map.value)
      geofenceCircles.delete(id)
    }
  }

  for (const g of props.geofences ?? []) {
    const existing = geofenceCircles.get(g.id)
    if (existing) {
      existing.setLatLng([g.lat, g.lng])
      existing.setRadius(g.radiusM)
    } else {
      const circle = L.circle([g.lat, g.lng], {
        radius: g.radiusM,
        color: g.isActive !== false ? '#6366f1' : '#9ca3af',
        fillColor: g.isActive !== false ? '#6366f1' : '#9ca3af',
        fillOpacity: 0.12,
        weight: 2,
      })
      circle.bindTooltip(g.name)
      circle.on('click', () => emit('geofenceClick', g.id))
      circle.addTo(map.value)
      geofenceCircles.set(g.id, circle)
    }
  }
}

function syncRoutes() {
  if (!map.value) return

  const currentIds = new Set((props.routes ?? []).map((r) => r.id))

  for (const [id, polyline] of routePolylines) {
    if (!currentIds.has(id)) {
      polyline.removeFrom(map.value)
      routePolylines.delete(id)
    }
  }

  ;(props.routes ?? []).forEach((r, idx) => {
    const latlngs = r.points.map((p) => [p.lat, p.lng] as L.LatLngTuple)
    const existing = routePolylines.get(r.id)
    if (existing) {
      existing.setLatLngs(latlngs)
    } else {
      const polyline = L.polyline(latlngs, {
        color: r.color ?? ROUTE_COLORS[idx % ROUTE_COLORS.length],
        weight: 4,
        opacity: 0.7,
      })
      polyline.addTo(map.value!)
      routePolylines.set(r.id, polyline)
    }
  })
}

function fitBoundsToVehicles() {
  if (!map.value || props.vehicles.length === 0) return
  const bounds = L.latLngBounds(props.vehicles.map((v) => [v.lat, v.lng] as L.LatLngTuple))
  map.value.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
}

function startTracking(vehicleId: string) {
  trackedVehicleId.value = vehicleId
}

function stopTracking() {
  trackedVehicleId.value = null
}

function handleTrackEvent(e: Event) {
  const id = (e as CustomEvent).detail
  if (id) startTracking(id)
}

watch(() => props.vehicles, syncVehicles, { deep: true })
watch(() => props.geofences, syncGeofences, { deep: true })
watch(() => props.routes, syncRoutes, { deep: true })

let initialFitDone = false

watch(
  () => props.vehicles.length,
  (len) => {
    if (len > 0 && !initialFitDone) {
      initialFitDone = true
      nextTick(() => fitBoundsToVehicles())
    }
  },
)

onMounted(() => {
  initMap()
  document.addEventListener('livemap:track', handleTrackEvent)
  nextTick(() => {
    syncVehicles()
    syncGeofences()
    syncRoutes()
    if (props.vehicles.length > 0) {
      initialFitDone = true
      fitBoundsToVehicles()
    }
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('livemap:track', handleTrackEvent)
  if (map.value) {
    map.value.remove()
    map.value = null
  }
  vehicleMarkers.clear()
  geofenceCircles.clear()
  routePolylines.clear()
})

defineExpose({ startTracking, stopTracking, fitBoundsToVehicles })
</script>

<template>
  <div class="relative overflow-hidden rounded-xl border border-gray-200 shadow-sm">
    <!-- Tracking indicator -->
    <div
      v-if="trackedVehicleId"
      class="absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
    >
      <span class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      Tracking
      <button
        class="ml-1 rounded-full p-0.5 hover:bg-indigo-500"
        @click="stopTracking"
      >
        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div ref="mapContainer" :style="{ height }" />
  </div>
</template>

<style>
.vehicle-marker {
  background: transparent !important;
  border: none !important;
}
</style>
