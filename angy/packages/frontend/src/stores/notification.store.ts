import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/plugins/axios';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: string;
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([]);
  const totalItems = ref(0);
  const loading = ref(false);

  const unreadCount = computed(
    () => notifications.value.filter((n) => !n.is_read).length,
  );

  async function fetchNotifications(page = 1, limit = 20) {
    loading.value = true;
    try {
      const res = await api.get('/api/v1/notifications', { params: { page, limit } });
      notifications.value = res.data.data ?? res.data;
      totalItems.value = res.data.meta?.totalItems ?? notifications.value.length;
    } catch {
      // silent fail
    } finally {
      loading.value = false;
    }
  }

  function addNotification(notification: Notification) {
    notifications.value.unshift(notification);
  }

  async function markAsRead(id: string) {
    try {
      await api.patch(`/api/v1/notifications/${id}`, { is_read: true });
      const n = notifications.value.find((n) => n.id === id);
      if (n) n.is_read = true;
    } catch {
      // silent fail
    }
  }

  async function markAllAsRead() {
    try {
      await api.post('/api/v1/notifications/read-all');
      notifications.value.forEach((n) => (n.is_read = true));
    } catch {
      // silent fail
    }
  }

  return {
    notifications,
    totalItems,
    loading,
    unreadCount,
    fetchNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
  };
});
