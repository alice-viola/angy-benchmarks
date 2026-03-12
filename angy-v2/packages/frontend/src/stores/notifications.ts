import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAxios } from '../composables/useAxios';
import type { NotificationResponse, PaginationMeta } from '@nexusfleet/shared';

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<NotificationResponse[]>([]);
  const unreadCount = ref(0);
  const pagination = ref<PaginationMeta>({ page: 1, page_size: 25, total_items: 0, total_pages: 0 });
  const loading = ref(false);

  async function fetch(params?: Record<string, unknown>) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get('/notifications', { params });
      notifications.value = res.data;
      pagination.value = res.meta;
      // unread_count is in meta
      if (res.meta?.unread_count !== undefined) {
        unreadCount.value = res.meta.unread_count;
      }
    } finally {
      loading.value = false;
    }
  }

  async function markRead(id: string) {
    const http = useAxios();
    const { data: res } = await http.put(`/notifications/${id}/read`);
    const idx = notifications.value.findIndex((n) => n.id === id);
    if (idx !== -1) {
      notifications.value[idx] = res.data;
    }
    if (unreadCount.value > 0) {
      unreadCount.value--;
    }
  }

  async function markAllRead() {
    const http = useAxios();
    await http.put('/notifications/read-all');
    notifications.value.forEach((n) => {
      (n as Record<string, unknown>).read_at = new Date().toISOString();
    });
    unreadCount.value = 0;
  }

  function addFromWS(notification: NotificationResponse) {
    notifications.value.unshift(notification);
    unreadCount.value++;
  }

  return {
    notifications,
    unreadCount,
    pagination,
    loading,
    fetch,
    markRead,
    markAllRead,
    addFromWS,
  };
});
