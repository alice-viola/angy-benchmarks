import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '../composables/useApi';
import { useToast } from '../composables/useToast';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const useNotificationStore = defineStore('notifications', () => {
  const api = useApi();
  const toast = useToast();

  const notifications = ref<Notification[]>([]);
  const loading = ref(false);

  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length);

  async function fetchNotifications() {
    loading.value = true;
    try {
      const { data: res } = await api.get('/notifications');
      notifications.value = res.data;
    } finally {
      loading.value = false;
    }
  }

  async function markAsRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      const notification = notifications.value.find((n) => n.id === id);
      if (notification) notification.read = true;
    } catch {
      toast.error('Failed to mark notification as read');
    }
  }

  async function markAllAsRead() {
    try {
      await api.post('/notifications/read-all');
      notifications.value.forEach((n) => {
        n.read = true;
      });
    } catch {
      toast.error('Failed to mark all notifications as read');
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
});
