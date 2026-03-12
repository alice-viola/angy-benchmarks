<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
    <div class="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8 w-full max-w-md">
      <div class="flex justify-center mb-6">
        <h1 class="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
          NexusFleet
        </h1>
      </div>
      <slot />
    </div>
  </div>
</template>
