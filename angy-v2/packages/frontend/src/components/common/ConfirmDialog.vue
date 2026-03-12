<script setup lang="ts">
import { AlertTriangle, X } from 'lucide-vue-next';

defineProps<{
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-center justify-center"
    >
      <!-- Overlay -->
      <div
        class="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        @click="emit('cancel')"
      />

      <!-- Dialog -->
      <div class="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 transition-all duration-200">
        <!-- Close button -->
        <button
          class="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
          @click="emit('cancel')"
        >
          <X class="w-5 h-5" />
        </button>

        <div class="px-6 pt-6 pb-0 flex flex-col items-center">
          <div
            :class="[
              'w-12 h-12 rounded-full flex items-center justify-center mb-4',
              variant === 'danger' ? 'bg-danger-50' : variant === 'warning' ? 'bg-warning-50' : 'bg-primary-50',
            ]"
          >
            <AlertTriangle
              :class="[
                'w-6 h-6',
                variant === 'danger' ? 'text-danger-500' : variant === 'warning' ? 'text-warning-500' : 'text-primary-500',
              ]"
            />
          </div>
          <h3 class="text-lg font-semibold text-neutral-800 mb-1 text-center">{{ title }}</h3>
          <p v-if="description" class="text-sm text-neutral-500 text-center">{{ description }}</p>
        </div>

        <div class="px-6 pb-6 pt-5 flex justify-end gap-3">
          <button
            class="bg-white text-neutral-700 border border-neutral-300 font-medium px-4 py-2.5 rounded-lg hover:bg-neutral-50 transition-all duration-150"
            @click="emit('cancel')"
          >
            {{ cancelLabel || 'Cancel' }}
          </button>
          <button
            :class="[
              'font-medium px-4 py-2.5 rounded-lg text-white transition-all duration-150',
              variant === 'danger'
                ? 'bg-danger-500 hover:bg-danger-600'
                : variant === 'warning'
                  ? 'bg-warning-500 hover:bg-warning-600'
                  : 'bg-primary-500 hover:bg-primary-600',
            ]"
            @click="emit('confirm')"
          >
            {{ confirmLabel || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
