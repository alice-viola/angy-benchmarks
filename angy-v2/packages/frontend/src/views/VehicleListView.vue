<script setup lang="ts">
import { Plus, Truck } from 'lucide-vue-next';
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">Vehicles</h1>
        <p class="text-sm text-neutral-400 mt-1">Manage your fleet vehicles</p>
      </div>
      <button class="bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-all duration-150 flex items-center gap-2">
        <Plus class="w-[18px] h-[18px]" />
        Add Vehicle
      </button>
    </div>

    <!-- Empty state placeholder -->
    <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
      <div class="flex flex-col items-center justify-center py-16">
        <div class="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <Truck class="w-7 h-7 text-neutral-300" />
        </div>
        <p class="text-sm font-medium text-neutral-600 mb-1">No vehicles yet</p>
        <p class="text-sm text-neutral-400 mb-4">Add your first vehicle to start managing your fleet.</p>
        <button class="bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-all duration-150 flex items-center gap-2">
          <Plus class="w-[18px] h-[18px]" />
          Add Vehicle
        </button>
      </div>
    </div>
  </div>
</template>
