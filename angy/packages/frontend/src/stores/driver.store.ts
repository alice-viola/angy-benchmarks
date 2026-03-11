import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/plugins/axios';
import { useToastStore } from './toast.store';
import type { CreateDriverInput, UpdateDriverInput } from '@nexus-fleet/shared';

export interface Driver {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  license_number: string;
  license_class: string;
  status: string;
  current_driving_hours: number;
  max_driving_hours_day: number;
  vehicle_id: string | null;
  vehicle?: { id: string; registration: string; make: string; model: string } | null;
  license_expiry: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverFilters {
  status?: string;
  page: number;
  limit: number;
}

export const useDriverStore = defineStore('driver', () => {
  const toast = useToastStore();
  const drivers = ref<Driver[]>([]);
  const currentDriver = ref<Driver | null>(null);
  const totalItems = ref(0);
  const loading = ref(false);
  const filters = ref<DriverFilters>({ page: 1, limit: 20 });

  async function fetchList(params?: Partial<DriverFilters>) {
    loading.value = true;
    try {
      if (params) Object.assign(filters.value, params);
      const res = await api.get('/api/v1/drivers', { params: filters.value });
      drivers.value = res.data.data;
      totalItems.value = res.data.meta?.totalItems ?? res.data.data.length;
    } catch (err) {
      toast.show('Failed to load drivers', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: string) {
    loading.value = true;
    try {
      const res = await api.get(`/api/v1/drivers/${id}`);
      currentDriver.value = res.data.data ?? res.data;
      return currentDriver.value;
    } catch (err) {
      toast.show('Failed to load driver', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: CreateDriverInput) {
    try {
      const res = await api.post('/api/v1/drivers', data);
      toast.show('Driver created', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to create driver', 'error');
      throw err;
    }
  }

  async function update(id: string, data: UpdateDriverInput) {
    try {
      const res = await api.patch(`/api/v1/drivers/${id}`, data);
      toast.show('Driver updated', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to update driver', 'error');
      throw err;
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/v1/drivers/${id}`);
      toast.show('Driver deleted', 'success');
    } catch (err) {
      toast.show('Failed to delete driver', 'error');
      throw err;
    }
  }

  async function assignVehicle(driverId: string, vehicleId: string) {
    try {
      const res = await api.post(`/api/v1/drivers/${driverId}/assign`, { vehicle_id: vehicleId });
      toast.show('Vehicle assigned', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to assign vehicle', 'error');
      throw err;
    }
  }

  async function unassignVehicle(driverId: string) {
    try {
      const res = await api.post(`/api/v1/drivers/${driverId}/unassign`);
      toast.show('Vehicle unassigned', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to unassign vehicle', 'error');
      throw err;
    }
  }

  return {
    drivers,
    currentDriver,
    totalItems,
    loading,
    filters,
    fetchList,
    fetchOne,
    create,
    update,
    remove,
    assignVehicle,
    unassignVehicle,
  };
});
