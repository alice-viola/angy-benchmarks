import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '@/composables/useApi';
import type { PaginationMeta, VehicleCreateInput, VehicleUpdateInput } from '@nexus-fleet/shared';
import type { Vehicle } from '@/types';

export const useVehiclesStore = defineStore('vehicles', () => {
  const api = useApi();

  const vehicles = ref<Vehicle[]>([]);
  const currentVehicle = ref<Vehicle | null>(null);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({
    page: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0,
  });

  async function fetchVehicles(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) {
    loading.value = true;
    try {
      const response = await api.get<Vehicle[]>('/vehicles', { params });
      if (response.success) {
        vehicles.value = response.data;
        if (response.meta) {
          pagination.value = response.meta;
        }
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchVehicle(id: string) {
    loading.value = true;
    try {
      const response = await api.get<Vehicle>(`/vehicles/${id}`);
      if (response.success) {
        currentVehicle.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createVehicle(input: VehicleCreateInput) {
    const response = await api.post<Vehicle>('/vehicles', input);
    if (response.success) {
      vehicles.value.unshift(response.data);
    }
    return response;
  }

  async function updateVehicle(id: string, input: VehicleUpdateInput) {
    const response = await api.put<Vehicle>(`/vehicles/${id}`, input);
    if (response.success) {
      const index = vehicles.value.findIndex((v) => v.id === id);
      if (index !== -1) {
        vehicles.value[index] = response.data;
      }
      if (currentVehicle.value?.id === id) {
        currentVehicle.value = response.data;
      }
    }
    return response;
  }

  async function deleteVehicle(id: string) {
    const response = await api.del(`/vehicles/${id}`);
    if (response.success) {
      vehicles.value = vehicles.value.filter((v) => v.id !== id);
      if (currentVehicle.value?.id === id) {
        currentVehicle.value = null;
      }
    }
    return response;
  }

  return {
    vehicles,
    currentVehicle,
    loading,
    pagination,
    fetchVehicles,
    fetchVehicle,
    createVehicle,
    updateVehicle,
    deleteVehicle,
  };
});
