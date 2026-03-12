<script setup lang="ts">
import { ref, provide, inject, onMounted, type InjectionKey } from 'vue';
import type { Toast, ToastType } from '@/types';

// Toast injection key
export const TOAST_KEY: InjectionKey<{
  show: (message: string, type?: ToastType, duration?: number) => void;
}> = Symbol('toast');

export function useToast() {
  const toast = inject(TOAST_KEY);
  if (!toast) {
    throw new Error('useToast must be used within a Toast provider');
  }
  return toast;
}

const toasts = ref<Toast[]>([]);

let nextId = 0;

function show(message: string, type: ToastType = 'info', duration = 5000) {
  const id = String(nextId++);
  toasts.value.push({ id, type, message, duration });

  if (duration > 0) {
    setTimeout(() => {
      remove(id);
    }, duration);
  }
}

function remove(id: string) {
  const index = toasts.value.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
}

provide(TOAST_KEY, { show });

const iconMap: Record<ToastType, string> = {
  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const bgMap: Record<ToastType, string> = {
  success: 'bg-success-50 border-success-200 text-success-800',
  error: 'bg-danger-50 border-danger-200 text-danger-800',
  warning: 'bg-warning-50 border-warning-200 text-warning-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconColorMap: Record<ToastType, string> = {
  success: 'text-success-500',
  error: 'text-danger-500',
  warning: 'text-warning-500',
  info: 'text-blue-500',
};
</script>

<template>
  <slot />

  <!-- Toast container -->
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] space-y-2 w-96 max-w-[calc(100vw-2rem)]">
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'flex items-start gap-3 rounded-lg border p-4 shadow-lg',
            bgMap[toast.type],
          ]"
        >
          <svg
            :class="['h-5 w-5 flex-shrink-0 mt-0.5', iconColorMap[toast.type]]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" :d="iconMap[toast.type]" />
          </svg>
          <p class="flex-1 text-sm">{{ toast.message }}</p>
          <button
            class="flex-shrink-0 opacity-50 hover:opacity-100"
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
