<script setup lang="ts">
import Modal from './Modal.vue';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}>(), {
  title: 'Are you sure?',
  message: undefined,
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'danger',
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const variantStyles: Record<string, { icon: string; iconBg: string; iconColor: string; btnClass: string }> = {
  danger: {
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    iconBg: 'bg-danger-100',
    iconColor: 'text-danger-600',
    btnClass: 'btn-danger',
  },
  warning: {
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    iconBg: 'bg-warning-100',
    iconColor: 'text-warning-600',
    btnClass: 'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500',
  },
  info: {
    icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    btnClass: 'btn-primary',
  },
};
</script>

<template>
  <Modal :is-open="isOpen" size="sm" @close="emit('cancel')">
    <div class="text-center sm:text-left">
      <div class="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:mx-0" :class="variantStyles[variant].iconBg">
        <svg
          class="h-6 w-6"
          :class="variantStyles[variant].iconColor"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" :d="variantStyles[variant].icon" />
        </svg>
      </div>

      <div class="mt-4">
        <h3 class="text-lg font-semibold text-slate-900">{{ title }}</h3>
        <p v-if="message" class="mt-2 text-sm text-slate-500">{{ message }}</p>
      </div>
    </div>

    <template #footer>
      <button class="btn-secondary" @click="emit('cancel')">
        {{ cancelText }}
      </button>
      <button
        :class="['btn', variantStyles[variant].btnClass]"
        @click="emit('confirm')"
      >
        {{ confirmText }}
      </button>
    </template>
  </Modal>
</template>
