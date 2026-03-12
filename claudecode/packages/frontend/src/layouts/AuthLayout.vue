<script setup lang="ts">
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 px-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="mb-8 text-center">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
          <svg class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white">NexusFleet</h1>
        <p class="mt-1 text-sm text-primary-200">Fleet Management Platform</p>
      </div>

      <!-- Card -->
      <div class="rounded-2xl bg-white p-8 shadow-2xl">
        <slot />
      </div>
    </div>
  </div>
</template>
