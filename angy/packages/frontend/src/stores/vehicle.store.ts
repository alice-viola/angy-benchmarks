import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/plugins/axios';
import { useToastStore } from './toast.store';
import type { CreateVehicleInput, UpdateVehicleInput } from '@nexus-fleet/shared';

export interface Vehicle {
  id: string;
  tenant_id: string;
  registration: string;
  type: string;
  make: string;
  model: string;
  year: number;
  status: string;
  capacity_kg: string | null;
  capacity_m3: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  driver?: { id: string; first_name: string; last_name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleFilters {
  vehicle_type?: string;
  status?: string;
  page: number;
  limit: number;
}

export const useVehicleStore = defineStore('vehicle', () => {
  const toast = useToastStore();
  const vehicles = ref<Vehicle[]>([]);
  const currentVehicle = ref<Vehicle | null>(null);
  const totalItems = ref(0);
  const loading = ref(false);
  const filters = ref<VehicleFilters>({ page: 1, limit: 20 });

  async function fetchList(params?: Partial<VehicleFilters>) {
    loading.value = true;
    try {
      if (params) Object.assign(filters.value, params);
      const res = await api.get('/api/v1/vehicles', { params: filters.value });
      vehicles.value = res.data.data;
      totalItems.value = res.data.meta?.totalItems ?? res.data.data.length;
    } catch (err) {
      toast.show('Failed to load vehicles', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: string) {
    loading.value = true;
    try {
      const res = await api.get(`/api/v1/vehicles/${id}`);
      currentVehicle.value = res.data.data ?? res.data;
      return currentVehicle.value;
    } catch (err) {
      toast.show('Failed to load vehicle', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: CreateVehicleInput) {
    try {
      const res = await api.post('/api/v1/vehicles', data);
      toast.show('Vehicle created', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to create vehicle', 'error');
      throw err;
    }
  }

  async function update(id: string, data: UpdateVehicleInput) {
    try {
      const res = await api.patch(`/api/v1/vehicles/${id}`, data);
      toast.show('Vehicle updated', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to update vehicle', 'error');
      throw err;
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/v1/vehicles/${id}`);
      toast.show('Vehicle deleted', 'success');
    } catch (err) {
      toast.show('Failed to delete vehicle', 'error');
      throw err;
    }
  }

  return {
    vehicles,
    currentVehicle,
    totalItems,
    loading,
    filters,
    fetchList,
    fetchOne,
    create,
    update,
    remove,
  };
});
