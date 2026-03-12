import { ref } from 'vue';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  dismissible?: boolean;
  duration?: number;
}

const toasts = ref<Toast[]>([]);
let idCounter = 0;

const DEFAULT_DURATIONS: Record<Toast['type'], number> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  error: 0, // manual dismiss
};

export function useToast() {
  function addToast(options: Omit<Toast, 'id'>) {
    const id = `toast-${++idCounter}`;
    const toast: Toast = {
      ...options,
      id,
      dismissible: options.dismissible ?? true,
      duration: options.duration ?? DEFAULT_DURATIONS[options.type],
    };

    toasts.value.push(toast);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }

    return id;
  }

  function removeToast(id: string) {
    const idx = toasts.value.findIndex((t) => t.id === id);
    if (idx !== -1) {
      toasts.value.splice(idx, 1);
    }
  }

  return {
    toasts,
    addToast,
    removeToast,
  };
}
