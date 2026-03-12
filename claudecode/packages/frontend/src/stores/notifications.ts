import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi';
import { useWebSocket } from '@/composables/useWebSocket';
import type { Notification } from '@/types';

export const useNotificationsStore = defineStore('notifications', () => {
  const api = useApi();

  const notifications = ref<Notification[]>([]);
  const loading = ref(false);
  let wsInstance: ReturnType<typeof useWebSocket> | null = null;

  const unreadCount = computed(
    () => notifications.value.filter((n) => !n.is_read).length,
  );

  async function fetchNotifications() {
    loading.value = true;
    try {
      const response = await api.get<Notification[]>('/notifications');
      if (response.success) {
        notifications.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function markAsRead(id: string) {
    const response = await api.put(`/notifications/${id}/read`);
    if (response.success) {
      const notification = notifications.value.find((n) => n.id === id);
      if (notification) {
        notification.is_read = true;
      }
    }
    return response;
  }

  async function markAllAsRead() {
    const response = await api.put('/notifications/read-all');
    if (response.success) {
      notifications.value.forEach((n) => {
        n.is_read = true;
      });
    }
    return response;
  }

  function connectWebSocket() {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws/dashboard`;

    wsInstance = useWebSocket({
      url: wsUrl,
      autoConnect: true,
    });

    wsInstance.subscribe(['notifications']);

    wsInstance.onMessage('notification', (data: Notification) => {
      notifications.value.unshift(data);
    });

    return () => {
      wsInstance?.close();
    };
  }

  function disconnectWebSocket() {
    wsInstance?.close();
    wsInstance = null;
  }

  return {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    connectWebSocket,
    disconnectWebSocket,
  };
});
