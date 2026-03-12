<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';
import RoutePlanner from '../components/routes/RoutePlanner.vue';
</script>

<template>
  <div>
    <div class="mb-6">
      <RouterLink to="/routes" class="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 transition-colors mb-3">
        <ArrowLeft class="w-4 h-4" />
        Back to Routes
      </RouterLink>
      <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">Route Planner</h1>
      <p class="text-sm text-neutral-400 mt-1">Plan and optimize delivery routes</p>
    </div>

    <RoutePlanner />
  </div>
</template>
