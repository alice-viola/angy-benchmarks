<script setup lang="ts">
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next';
import { useToast, type Toast } from '../../composables/useToast';

const { toasts, removeToast } = useToast();

const icons: Record<Toast['type'], typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<Toast['type'], { bg: string; icon: string }> = {
  success: { bg: 'bg-success-50', icon: 'text-success-500' },
  error: { bg: 'bg-danger-50', icon: 'text-danger-500' },
  warning: { bg: 'bg-warning-50', icon: 'text-warning-500' },
  info: { bg: 'bg-info-50', icon: 'text-info-500' },
};
</script>

<template>
  <div class="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="bg-white rounded-xl shadow-lg border border-neutral-200 p-4 flex gap-3 animate-slide-in-right"
    >
      <div
        :class="[
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          colors[toast.type].bg,
        ]"
      >
        <component :is="icons[toast.type]" :class="['w-4 h-4', colors[toast.type].icon]" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-neutral-800">{{ toast.title }}</p>
        <p v-if="toast.message" class="text-xs text-neutral-500 mt-0.5">{{ toast.message }}</p>
      </div>
      <button
        v-if="toast.dismissible"
        class="text-neutral-400 hover:text-neutral-600 flex-shrink-0"
        @click="removeToast(toast.id)"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
