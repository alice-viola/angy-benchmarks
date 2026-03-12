import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '@/composables/useApi';
import type { PaginationMeta, DriverCreateInput, DriverUpdateInput } from '@nexus-fleet/shared';
import type { Driver } from '@/types';

export const useDriversStore = defineStore('drivers', () => {
  const api = useApi();

  const drivers = ref<Driver[]>([]);
  const currentDriver = ref<Driver | null>(null);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({
    page: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0,
  });

  async function fetchDrivers(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) {
    loading.value = true;
    try {
      const response = await api.get<Driver[]>('/drivers', { params });
      if (response.success) {
        drivers.value = response.data;
        if (response.meta) {
          pagination.value = response.meta;
        }
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchDriver(id: string) {
    loading.value = true;
    try {
      const response = await api.get<Driver>(`/drivers/${id}`);
      if (response.success) {
        currentDriver.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createDriver(input: DriverCreateInput) {
    const response = await api.post<Driver>('/drivers', input);
    if (response.success) {
      drivers.value.unshift(response.data);
    }
    return response;
  }

  async function updateDriver(id: string, input: DriverUpdateInput) {
    const response = await api.put<Driver>(`/drivers/${id}`, input);
    if (response.success) {
      const index = drivers.value.findIndex((d) => d.id === id);
      if (index !== -1) {
        drivers.value[index] = response.data;
      }
      if (currentDriver.value?.id === id) {
        currentDriver.value = response.data;
      }
    }
    return response;
  }

  async function deleteDriver(id: string) {
    const response = await api.del(`/drivers/${id}`);
    if (response.success) {
      drivers.value = drivers.value.filter((d) => d.id !== id);
      if (currentDriver.value?.id === id) {
        currentDriver.value = null;
      }
    }
    return response;
  }

  return {
    drivers,
    currentDriver,
    loading,
    pagination,
    fetchDrivers,
    fetchDriver,
    createDriver,
    updateDriver,
    deleteDriver,
  };
});
