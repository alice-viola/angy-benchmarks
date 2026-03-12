<script setup lang="ts">
import { Plus, Route } from 'lucide-vue-next';
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">Routes</h1>
        <p class="text-sm text-neutral-400 mt-1">View and manage delivery routes</p>
      </div>
      <RouterLink
        to="/routes/planner"
        class="bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-all duration-150 flex items-center gap-2"
      >
        <Plus class="w-[18px] h-[18px]" />
        Plan Route
      </RouterLink>
    </div>

    <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
      <div class="flex flex-col items-center justify-center py-16">
        <div class="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <Route class="w-7 h-7 text-neutral-300" />
        </div>
        <p class="text-sm font-medium text-neutral-600 mb-1">No routes yet</p>
        <p class="text-sm text-neutral-400 mb-4">Plan your first route to optimize fleet deliveries.</p>
        <RouterLink
          to="/routes/planner"
          class="bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-all duration-150 flex items-center gap-2"
        >
          <Plus class="w-[18px] h-[18px]" />
          Plan Route
        </RouterLink>
      </div>
    </div>
  </div>
</template>
