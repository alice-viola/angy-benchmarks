import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type {
  Vehicle,
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleFilterParams,
} from '@nexus-fleet/shared';
import { useApi } from '../composables/useApi';
import { useToast } from '../composables/useToast';

export const useVehicleStore = defineStore('vehicles', () => {
  const api = useApi();
  const toast = useToast();

  const vehicles = ref<Vehicle[]>([]);
  const currentVehicle = ref<Vehicle | null>(null);
  const loading = ref(false);
  const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  async function fetchVehicles(params?: Partial<VehicleFilterParams>) {
    loading.value = true;
    try {
      const query = { ...params, page: params?.page ?? pagination.page, limit: params?.limit ?? pagination.pageSize };
      const { data: res } = await api.get('/vehicles', { params: query });
      vehicles.value = res.data;
      if (res.pagination) {
        pagination.page = res.pagination.page;
        pagination.pageSize = res.pagination.limit;
        pagination.total = res.pagination.total;
        pagination.totalPages = res.pagination.totalPages;
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchVehicle(id: string) {
    loading.value = true;
    try {
      const { data: res } = await api.get(`/vehicles/${id}`);
      currentVehicle.value = res.data;
      return res.data as Vehicle;
    } finally {
      loading.value = false;
    }
  }

  async function createVehicle(data: CreateVehicleInput) {
    loading.value = true;
    try {
      const { data: res } = await api.post('/vehicles', data);
      vehicles.value.unshift(res.data);
      toast.success('Vehicle created');
      return res.data as Vehicle;
    } finally {
      loading.value = false;
    }
  }

  async function updateVehicle(id: string, data: UpdateVehicleInput) {
    loading.value = true;
    try {
      const { data: res } = await api.patch(`/vehicles/${id}`, data);
      const idx = vehicles.value.findIndex((v) => v.id === id);
      if (idx !== -1) vehicles.value[idx] = res.data;
      if (currentVehicle.value?.id === id) currentVehicle.value = res.data;
      toast.success('Vehicle updated');
      return res.data as Vehicle;
    } finally {
      loading.value = false;
    }
  }

  async function deleteVehicle(id: string) {
    loading.value = true;
    try {
      await api.delete(`/vehicles/${id}`);
      vehicles.value = vehicles.value.filter((v) => v.id !== id);
      if (currentVehicle.value?.id === id) currentVehicle.value = null;
      toast.success('Vehicle deleted');
    } finally {
      loading.value = false;
    }
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
