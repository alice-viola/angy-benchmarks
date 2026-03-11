<script setup lang="ts">
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-800 px-4 py-12">
    <!-- Subtle background pattern -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary-600/20 blur-3xl" />
      <div class="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
    </div>

    <div class="relative z-10 w-full max-w-md">
      <!-- Logo -->
      <div class="mb-8 text-center">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-600/30">
          <span class="text-xl font-bold text-white">NF</span>
        </div>
        <h1 class="text-2xl font-bold text-white">NexusFleet</h1>
        <p class="mt-1 text-sm text-slate-400">Fleet Management Platform</p>
      </div>

      <!-- Card -->
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl">
        <slot />
      </div>

      <!-- Footer -->
      <p class="mt-6 text-center text-xs text-slate-500">
        &copy; {{ new Date().getFullYear() }} NexusFleet. All rights reserved.
      </p>
    </div>
  </div>
</template>
