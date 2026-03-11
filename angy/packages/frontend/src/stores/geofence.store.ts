import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/plugins/axios';
import { useToastStore } from './toast.store';
import type { CreateGeofenceInput, UpdateGeofenceInput } from '@nexus-fleet/shared';

export interface Geofence {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  type: 'circle' | 'polygon';
  center_latitude: number | null;
  center_longitude: number | null;
  radius_meters: number | null;
  polygon_coordinates: Array<{ latitude: number; longitude: number }> | null;
  trigger_on_enter: boolean;
  trigger_on_exit: boolean;
  is_active: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeofenceFilters {
  type?: string;
  is_active?: boolean;
  page: number;
  limit: number;
}

export const useGeofenceStore = defineStore('geofence', () => {
  const toast = useToastStore();
  const geofences = ref<Geofence[]>([]);
  const currentGeofence = ref<Geofence | null>(null);
  const totalItems = ref(0);
  const loading = ref(false);
  const filters = ref<GeofenceFilters>({ page: 1, limit: 20 });

  async function fetchList(params?: Partial<GeofenceFilters>) {
    loading.value = true;
    try {
      if (params) Object.assign(filters.value, params);
      const res = await api.get('/api/v1/geofences', { params: filters.value });
      geofences.value = res.data.data;
      totalItems.value = res.data.meta?.totalItems ?? res.data.data.length;
    } catch (err) {
      toast.show('Failed to load geofences', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: string) {
    loading.value = true;
    try {
      const res = await api.get(`/api/v1/geofences/${id}`);
      currentGeofence.value = res.data.data ?? res.data;
      return currentGeofence.value;
    } catch (err) {
      toast.show('Failed to load geofence', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: CreateGeofenceInput) {
    try {
      const res = await api.post('/api/v1/geofences', data);
      toast.show('Geofence created', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to create geofence', 'error');
      throw err;
    }
  }

  async function update(id: string, data: UpdateGeofenceInput) {
    try {
      const res = await api.patch(`/api/v1/geofences/${id}`, data);
      toast.show('Geofence updated', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to update geofence', 'error');
      throw err;
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/v1/geofences/${id}`);
      toast.show('Geofence deleted', 'success');
    } catch (err) {
      toast.show('Failed to delete geofence', 'error');
      throw err;
    }
  }

  async function toggleActive(id: string, is_active: boolean) {
    try {
      await api.patch(`/api/v1/geofences/${id}`, { is_active });
      const gf = geofences.value.find((g) => g.id === id);
      if (gf) gf.is_active = is_active;
      toast.show(`Geofence ${is_active ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
      toast.show('Failed to update geofence', 'error');
      throw err;
    }
  }

  return {
    geofences,
    currentGeofence,
    totalItems,
    loading,
    filters,
    fetchList,
    fetchOne,
    create,
    update,
    remove,
    toggleActive,
  };
});
