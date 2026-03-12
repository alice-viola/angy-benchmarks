<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, Package } from 'lucide-vue-next';

const route = useRoute();
const id = ref(route.params.id as string);
const loading = ref(false);
</script>

<template>
  <div>
    <div class="mb-6">
      <RouterLink :to="`/shipments/${id}`" class="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 transition-colors mb-3">
        <ArrowLeft class="w-4 h-4" />
        Back to Shipment
      </RouterLink>
      <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">Edit Shipment</h1>
      <p class="text-sm text-neutral-400 mt-1">Update shipment {{ id }}</p>
    </div>

    <div v-if="loading" class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
      <div class="animate-pulse space-y-4">
        <div class="h-4 bg-neutral-100 rounded w-1/3"></div>
        <div class="h-4 bg-neutral-100 rounded w-1/2"></div>
      </div>
    </div>

    <div v-else class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
      <div class="flex flex-col items-center justify-center py-16">
        <div class="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <Package class="w-7 h-7 text-neutral-300" />
        </div>
        <p class="text-sm font-medium text-neutral-600 mb-1">Edit Form</p>
        <p class="text-sm text-neutral-400">Shipment edit form will be implemented here</p>
      </div>
    </div>
  </div>
</template>
