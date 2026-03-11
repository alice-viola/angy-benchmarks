<script setup lang="ts">
import FleetOverviewCards from '@/components/analytics/FleetOverviewCards.vue';
import ShipmentsByStatusChart from '@/components/analytics/ShipmentsByStatusChart.vue';
import DeliveriesOverTimeChart from '@/components/analytics/DeliveriesOverTimeChart.vue';
import AlertsFeed from '@/components/common/AlertsFeed.vue';
import LiveMap from '@/components/map/LiveMap.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

function onStatusFilter(status: string) {
  router.push({ path: '/shipments', query: { state: status } });
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>
    <FleetOverviewCards class="mb-6" />
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <ShipmentsByStatusChart @filter="onStatusFilter" />
      <DeliveriesOverTimeChart />
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <AlertsFeed />
      <LiveMap height="384px" />
    </div>
  </div>
</template>
