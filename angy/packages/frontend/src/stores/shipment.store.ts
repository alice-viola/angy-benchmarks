import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/plugins/axios';
import { useToastStore } from './toast.store';
import type { CreateShipmentInput, UpdateShipmentInput } from '@nexus-fleet/shared';

export interface Shipment {
  id: string;
  tenant_id: string;
  reference_code: string | null;
  status: string;
  priority: string;
  customer_name: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  dest_address: string;
  dest_lat: number;
  dest_lng: number;
  scheduled_pickup_at: string | null;
  scheduled_delivery_at: string | null;
  cargo_description: string | null;
  cargo_weight_kg: number;
  cargo_volume_m3: number;
  cargo_type: string;
  requires_temp_control: boolean;
  temp_min_c: number | null;
  temp_max_c: number | null;
  notes: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  assigned_driver?: { id: string; first_name: string; last_name: string } | null;
  assigned_vehicle?: { id: string; registration: string } | null;
  pod_signature_url: string | null;
  pod_photo_urls: string[];
  pod_notes: string | null;
  failure_reason: string | null;
  cancellation_reason: string | null;
  events?: ShipmentEvent[];
  created_at: string;
  updated_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  from_state: string;
  to_state: string;
  action: string;
  notes: string | null;
  performed_by: string | null;
  performed_by_user?: { first_name: string; last_name: string };
  created_at: string;
}

export interface ShipmentFilters {
  status?: string;
  search?: string;
  page: number;
  limit: number;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
}

export const useShipmentStore = defineStore('shipment', () => {
  const toast = useToastStore();
  const shipments = ref<Shipment[]>([]);
  const currentShipment = ref<Shipment | null>(null);
  const totalItems = ref(0);
  const loading = ref(false);
  const filters = ref<ShipmentFilters>({ page: 1, limit: 20 });

  async function fetchList(params?: Partial<ShipmentFilters>) {
    loading.value = true;
    try {
      if (params) Object.assign(filters.value, params);
      const res = await api.get('/api/v1/shipments', { params: filters.value });
      shipments.value = res.data.data;
      totalItems.value = res.data.meta?.totalItems ?? res.data.data.length;
    } catch (err) {
      toast.show('Failed to load shipments', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: string) {
    loading.value = true;
    try {
      const res = await api.get(`/api/v1/shipments/${id}`);
      currentShipment.value = res.data.data ?? res.data;
      return currentShipment.value;
    } catch (err) {
      toast.show('Failed to load shipment', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: CreateShipmentInput) {
    try {
      const res = await api.post('/api/v1/shipments', data);
      toast.show('Shipment created', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to create shipment', 'error');
      throw err;
    }
  }

  async function update(id: string, data: UpdateShipmentInput) {
    try {
      const res = await api.patch(`/api/v1/shipments/${id}`, data);
      toast.show('Shipment updated', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to update shipment', 'error');
      throw err;
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/v1/shipments/${id}`);
      toast.show('Shipment deleted', 'success');
    } catch (err) {
      toast.show('Failed to delete shipment', 'error');
      throw err;
    }
  }

  async function transition(id: string, action: string, data?: Record<string, unknown>) {
    try {
      const res = await api.post(`/api/v1/shipments/${id}/actions`, { action, ...data });
      toast.show(`Shipment ${action} successful`, 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show(`Failed to ${action} shipment`, 'error');
      throw err;
    }
  }

  return {
    shipments,
    currentShipment,
    totalItems,
    loading,
    filters,
    fetchList,
    fetchOne,
    create,
    update,
    remove,
    transition,
  };
});
