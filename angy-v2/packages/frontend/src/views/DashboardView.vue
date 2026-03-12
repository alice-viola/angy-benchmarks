<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTrackingStore } from '../stores/tracking';
import { useGeofenceStore } from '../stores/geofences';
import { AlertTriangle, RefreshCw } from 'lucide-vue-next';
import { useAxios } from '../composables/useAxios';
import FleetOverviewCards from '../components/dashboard/FleetOverviewCards.vue';
import ShipmentsByStatusChart from '../components/dashboard/ShipmentsByStatusChart.vue';
import DeliveriesOverTimeChart from '../components/dashboard/DeliveriesOverTimeChart.vue';
import RecentAlertsFeed from '../components/dashboard/RecentAlertsFeed.vue';
import LiveMap from '../components/map/LiveMap.vue';
import type { MapVehicle } from '../components/map/LiveMap.vue';

const router = useRouter();
const authStore = useAuthStore();
const trackingStore = useTrackingStore();
const geofenceStore = useGeofenceStore();

const loading = ref(true);
const error = ref('');

interface OverviewData {
  vehicles: { total: number; active: number; available: number; in_transit: number; maintenance: number };
  drivers: { total: number; on_duty: number; off_duty: number; driving: number };
  shipments: { active: number; delivered_today: number; by_status: Record<string, number> };
}

interface DailyDelivery {
  date: string;
  completed: number;
  failed: number;
}

const overview = ref<OverviewData | null>(null);
const deliveryData = ref<DailyDelivery[] | null>(null);
const recentAlerts = ref<Array<{
  id: string;
  event_type: string;
  geofence_name?: string;
  vehicle_registration?: string;
  triggered_at: string;
}>>([]);

const greeting = (() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
})();

const firstName = computed(() => {
  const u = authStore.user;
  if (u && 'first_name' in u) return (u as Record<string, unknown>).first_name as string;
  return '';
});

// Convert tracking positions to map vehicles
const mapVehicles = computed<MapVehicle[]>(() => {
  return trackingStore.vehiclePositionsList.map((pos) => ({
    id: pos.vehicle_id,
    lat: pos.lat,
    lng: pos.lng,
    heading: pos.heading,
    speed_kmh: pos.speed_kmh,
    status: 'in_transit',
  }));
});

async function fetchDashboardData() {
  loading.value = true;
  error.value = '';
  try {
    const http = useAxios();

    // Fetch overview + delivery stats in parallel
    const [overviewRes, deliveryRes] = await Promise.all([
      http.get('/analytics/overview'),
      http.get('/analytics/shipments', {
        params: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0],
        },
      }).catch(() => null),
    ]);

    overview.value = overviewRes.data.data;
    if (deliveryRes) {
      deliveryData.value = deliveryRes.data.data.daily || [];
    }

    // Fetch geofences for map overlay
    await geofenceStore.list({ page_size: 100 }).catch(() => {});
  } catch {
    error.value = 'Failed to load dashboard data';
  } finally {
    loading.value = false;
  }
}

function handleStatusFilter(status: string) {
  router.push({ name: 'shipments', query: { status } });
}

onMounted(() => {
  trackingStore.connect();
  fetchDashboardData();
});
</script>

<template>
  <div>
    <!-- Greeting -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">
        <span class="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
          {{ greeting }}, {{ firstName }}
        </span>
      </h1>
      <p class="text-sm text-neutral-400 mt-1">Here's an overview of your fleet operations</p>
    </div>

    <!-- Error state -->
    <div v-if="error" class="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 flex items-center gap-3 mb-6">
      <AlertTriangle class="w-4 h-4 text-danger-500 flex-shrink-0" />
      <p class="text-sm text-danger-700 flex-1">{{ error }}</p>
      <button
        class="text-sm font-medium text-danger-600 hover:text-danger-700 flex items-center gap-1"
        @click="fetchDashboardData"
      >
        <RefreshCw class="w-3.5 h-3.5" />
        Retry
      </button>
    </div>

    <!-- Fleet Overview Cards -->
    <div class="mb-8">
      <FleetOverviewCards :stats="overview" :loading="loading" />
    </div>

    <!-- Map + Chart row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="lg:col-span-2">
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
          <h2 class="text-base font-medium text-neutral-800 mb-4">Live Fleet Map</h2>
          <LiveMap
            :vehicles="mapVehicles"
            :geofences="geofenceStore.geofences"
            height="350px"
          />
        </div>
      </div>

      <ShipmentsByStatusChart
        :data="overview?.shipments.by_status ?? null"
        :loading="loading"
        @filter="handleStatusFilter"
      />
    </div>

    <!-- Charts + Alerts row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <DeliveriesOverTimeChart :data="deliveryData" :loading="loading" />
      </div>

      <RecentAlertsFeed :alerts="recentAlerts" :loading="loading" />
    </div>
  </div>
</template>
