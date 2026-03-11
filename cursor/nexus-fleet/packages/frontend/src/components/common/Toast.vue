<script setup lang="ts">
import { useToast, type ToastType } from '../../composables/useToast';

const { toasts, remove } = useToast();

const styles: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    iconColor: 'text-emerald-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
    iconColor: 'text-red-500',
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    iconColor: 'text-orange-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
    iconColor: 'text-blue-500',
  },
};
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-0 top-0 z-[100] flex flex-col items-end gap-2 p-4" aria-live="polite">
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
        move-class="transition-all duration-300"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'pointer-events-auto flex w-80 items-start gap-3 rounded-xl border p-4 shadow-lg',
            styles[toast.type].bg,
            styles[toast.type].border,
          ]"
          role="alert"
        >
          <svg
            :class="['h-5 w-5 shrink-0 mt-0.5', styles[toast.type].iconColor]"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" :d="styles[toast.type].icon" />
          </svg>
          <p class="flex-1 text-sm text-slate-700">{{ toast.message }}</p>
          <button
            class="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            @click="remove(toast.id)"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
