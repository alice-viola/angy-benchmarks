import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '@/composables/useApi';
import type { PaginationMeta, GeofenceCreateInput } from '@nexus-fleet/shared';
import type { Geofence } from '@/types';

export const useGeofencesStore = defineStore('geofences', () => {
  const api = useApi();

  const geofences = ref<Geofence[]>([]);
  const currentGeofence = ref<Geofence | null>(null);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({
    page: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0,
  });

  async function fetchGeofences(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    loading.value = true;
    try {
      const response = await api.get<Geofence[]>('/geofences', { params });
      if (response.success) {
        geofences.value = response.data;
        if (response.meta) {
          pagination.value = response.meta;
        }
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchGeofence(id: string) {
    loading.value = true;
    try {
      const response = await api.get<Geofence>(`/geofences/${id}`);
      if (response.success) {
        currentGeofence.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createGeofence(input: GeofenceCreateInput) {
    const response = await api.post<Geofence>('/geofences', input);
    if (response.success) {
      geofences.value.unshift(response.data);
    }
    return response;
  }

  async function updateGeofence(id: string, input: Partial<GeofenceCreateInput>) {
    const response = await api.put<Geofence>(`/geofences/${id}`, input);
    if (response.success) {
      const index = geofences.value.findIndex((g) => g.id === id);
      if (index !== -1) {
        geofences.value[index] = response.data;
      }
      if (currentGeofence.value?.id === id) {
        currentGeofence.value = response.data;
      }
    }
    return response;
  }

  async function deleteGeofence(id: string) {
    const response = await api.del(`/geofences/${id}`);
    if (response.success) {
      geofences.value = geofences.value.filter((g) => g.id !== id);
      if (currentGeofence.value?.id === id) {
        currentGeofence.value = null;
      }
    }
    return response;
  }

  return {
    geofences,
    currentGeofence,
    loading,
    pagination,
    fetchGeofences,
    fetchGeofence,
    createGeofence,
    updateGeofence,
    deleteGeofence,
  };
});
