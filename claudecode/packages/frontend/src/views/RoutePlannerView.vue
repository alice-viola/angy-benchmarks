<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import RoutePlanner from '@/components/routes/RoutePlanner.vue';

const router = useRouter();

function handleSaved(routeId: string) {
  router.push(`/routes/${routeId}`);
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <h1 class="page-title">Route Planner</h1>
    </div>
    <RoutePlanner @saved="handleSaved" />
  </AppLayout>
</template>
