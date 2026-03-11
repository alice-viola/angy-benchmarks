import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type {
  Driver,
  CreateDriverInput,
  UpdateDriverInput,
  DriverFilterParams,
} from '@nexus-fleet/shared';
import { useApi } from '../composables/useApi';
import { useToast } from '../composables/useToast';

export const useDriverStore = defineStore('drivers', () => {
  const api = useApi();
  const toast = useToast();

  const drivers = ref<Driver[]>([]);
  const currentDriver = ref<Driver | null>(null);
  const loading = ref(false);
  const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  async function fetchDrivers(params?: Partial<DriverFilterParams>) {
    loading.value = true;
    try {
      const query = { ...params, page: params?.page ?? pagination.page, limit: params?.limit ?? pagination.pageSize };
      const { data: res } = await api.get('/drivers', { params: query });
      drivers.value = res.data;
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

  async function fetchDriver(id: string) {
    loading.value = true;
    try {
      const { data: res } = await api.get(`/drivers/${id}`);
      currentDriver.value = res.data;
      return res.data as Driver;
    } finally {
      loading.value = false;
    }
  }

  async function createDriver(data: CreateDriverInput) {
    loading.value = true;
    try {
      const { data: res } = await api.post('/drivers', data);
      drivers.value.unshift(res.data);
      toast.success('Driver created');
      return res.data as Driver;
    } finally {
      loading.value = false;
    }
  }

  async function updateDriver(id: string, data: UpdateDriverInput) {
    loading.value = true;
    try {
      const { data: res } = await api.patch(`/drivers/${id}`, data);
      const idx = drivers.value.findIndex((d) => d.id === id);
      if (idx !== -1) drivers.value[idx] = res.data;
      if (currentDriver.value?.id === id) currentDriver.value = res.data;
      toast.success('Driver updated');
      return res.data as Driver;
    } finally {
      loading.value = false;
    }
  }

  async function deleteDriver(id: string) {
    loading.value = true;
    try {
      await api.delete(`/drivers/${id}`);
      drivers.value = drivers.value.filter((d) => d.id !== id);
      if (currentDriver.value?.id === id) currentDriver.value = null;
      toast.success('Driver deleted');
    } finally {
      loading.value = false;
    }
  }

  async function assignVehicle(driverId: string, vehicleId: string) {
    loading.value = true;
    try {
      const { data: res } = await api.post(`/drivers/${driverId}/assign-vehicle`, { vehicleId });
      const idx = drivers.value.findIndex((d) => d.id === driverId);
      if (idx !== -1) drivers.value[idx] = res.data;
      if (currentDriver.value?.id === driverId) currentDriver.value = res.data;
      toast.success('Vehicle assigned to driver');
      return res.data as Driver;
    } finally {
      loading.value = false;
    }
  }

  async function unassignVehicle(driverId: string) {
    loading.value = true;
    try {
      const { data: res } = await api.post(`/drivers/${driverId}/unassign-vehicle`);
      const idx = drivers.value.findIndex((d) => d.id === driverId);
      if (idx !== -1) drivers.value[idx] = res.data;
      if (currentDriver.value?.id === driverId) currentDriver.value = res.data;
      toast.success('Vehicle unassigned from driver');
      return res.data as Driver;
    } finally {
      loading.value = false;
    }
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
    assignVehicle,
    unassignVehicle,
  };
});
