import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type {
  Shipment,
  CreateShipmentInput,
  UpdateShipmentInput,
  ShipmentTransitionAction,
  ShipmentFilterParams,
} from '@nexus-fleet/shared';
import { useApi } from '../composables/useApi';
import { useToast } from '../composables/useToast';

export const useShipmentStore = defineStore('shipments', () => {
  const api = useApi();
  const toast = useToast();

  const shipments = ref<Shipment[]>([]);
  const currentShipment = ref<Shipment | null>(null);
  const loading = ref(false);
  const filters = reactive<Partial<ShipmentFilterParams>>({});
  const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  async function fetchShipments(params?: Partial<ShipmentFilterParams>) {
    loading.value = true;
    try {
      const query = { ...filters, ...params, page: params?.page ?? pagination.page, limit: params?.limit ?? pagination.pageSize };
      const { data: res } = await api.get('/shipments', { params: query });
      shipments.value = res.data;
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

  async function fetchShipment(id: string) {
    loading.value = true;
    try {
      const { data: res } = await api.get(`/shipments/${id}`);
      currentShipment.value = res.data;
      return res.data as Shipment;
    } finally {
      loading.value = false;
    }
  }

  async function createShipment(data: CreateShipmentInput) {
    loading.value = true;
    try {
      const { data: res } = await api.post('/shipments', data);
      shipments.value.unshift(res.data);
      toast.success('Shipment created');
      return res.data as Shipment;
    } finally {
      loading.value = false;
    }
  }

  async function updateShipment(id: string, data: UpdateShipmentInput) {
    loading.value = true;
    try {
      const { data: res } = await api.patch(`/shipments/${id}`, data);
      const idx = shipments.value.findIndex((s) => s.id === id);
      if (idx !== -1) shipments.value[idx] = res.data;
      if (currentShipment.value?.id === id) currentShipment.value = res.data;
      toast.success('Shipment updated');
      return res.data as Shipment;
    } finally {
      loading.value = false;
    }
  }

  async function deleteShipment(id: string) {
    loading.value = true;
    try {
      await api.delete(`/shipments/${id}`);
      shipments.value = shipments.value.filter((s) => s.id !== id);
      if (currentShipment.value?.id === id) currentShipment.value = null;
      toast.success('Shipment deleted');
    } finally {
      loading.value = false;
    }
  }

  async function transitionShipment(id: string, action: ShipmentTransitionAction, data?: { vehicleId?: string; driverId?: string; notes?: string }) {
    loading.value = true;
    try {
      const { data: res } = await api.post(`/shipments/${id}/transition`, { action, ...data });
      const idx = shipments.value.findIndex((s) => s.id === id);
      if (idx !== -1) shipments.value[idx] = res.data;
      if (currentShipment.value?.id === id) currentShipment.value = res.data;
      toast.success(`Shipment ${action} successful`);
      return res.data as Shipment;
    } finally {
      loading.value = false;
    }
  }

  async function fetchEvents(id: string) {
    const { data: res } = await api.get(`/shipments/${id}/events`);
    return res.data;
  }

  return {
    shipments,
    currentShipment,
    loading,
    filters,
    pagination,
    fetchShipments,
    fetchShipment,
    createShipment,
    updateShipment,
    deleteShipment,
    transitionShipment,
    fetchEvents,
  };
});
