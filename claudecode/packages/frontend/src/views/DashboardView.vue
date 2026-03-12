<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useTrackingStore } from '@/stores/tracking';
import AppLayout from '@/layouts/AppLayout.vue';
import FleetOverviewCards from '@/components/analytics/FleetOverviewCards.vue';
import LiveMap from '@/components/map/LiveMap.vue';
import ShipmentChart from '@/components/analytics/ShipmentChart.vue';
import DeliveryChart from '@/components/analytics/DeliveryChart.vue';
import AlertsFeed from '@/components/analytics/AlertsFeed.vue';

const trackingStore = useTrackingStore();
let cleanup: (() => void) | null = null;

onMounted(() => {
  cleanup = trackingStore.connect();
});

onUnmounted(() => {
  cleanup?.();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Fleet overview cards -->
      <FleetOverviewCards />

      <!-- Map and charts row -->
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2">
          <LiveMap height="400px" />
        </div>
        <div>
          <AlertsFeed />
        </div>
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShipmentChart />
        <DeliveryChart />
      </div>
    </div>
  </AppLayout>
</template>
