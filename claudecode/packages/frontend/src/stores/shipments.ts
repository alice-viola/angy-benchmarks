import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '@/composables/useApi';
import type { PaginationMeta, ShipmentCreateInput, ShipmentUpdateInput, ShipmentTransitionInput } from '@nexus-fleet/shared';
import type { Shipment, ShipmentEvent } from '@/types';

export const useShipmentsStore = defineStore('shipments', () => {
  const api = useApi();

  const shipments = ref<Shipment[]>([]);
  const currentShipment = ref<Shipment | null>(null);
  const events = ref<ShipmentEvent[]>([]);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({
    page: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0,
  });
  const filters = ref<Record<string, string>>({});

  async function fetchShipments(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    priority?: string;
    search?: string;
  }) {
    loading.value = true;
    try {
      const response = await api.get<Shipment[]>('/shipments', { params });
      if (response.success) {
        shipments.value = response.data;
        if (response.meta) {
          pagination.value = response.meta;
        }
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchShipment(id: string) {
    loading.value = true;
    try {
      const response = await api.get<Shipment>(`/shipments/${id}`);
      if (response.success) {
        currentShipment.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createShipment(input: ShipmentCreateInput) {
    const response = await api.post<Shipment>('/shipments', input);
    if (response.success) {
      shipments.value.unshift(response.data);
    }
    return response;
  }

  async function updateShipment(id: string, input: ShipmentUpdateInput) {
    const response = await api.put<Shipment>(`/shipments/${id}`, input);
    if (response.success) {
      const index = shipments.value.findIndex((s) => s.id === id);
      if (index !== -1) {
        shipments.value[index] = response.data;
      }
      if (currentShipment.value?.id === id) {
        currentShipment.value = response.data;
      }
    }
    return response;
  }

  async function transitionShipment(id: string, input: ShipmentTransitionInput) {
    const response = await api.post<Shipment>(`/shipments/${id}/transition`, input);
    if (response.success) {
      const index = shipments.value.findIndex((s) => s.id === id);
      if (index !== -1) {
        shipments.value[index] = response.data;
      }
      if (currentShipment.value?.id === id) {
        currentShipment.value = response.data;
      }
    }
    return response;
  }

  async function fetchEvents(shipmentId: string) {
    const response = await api.get<ShipmentEvent[]>(`/shipments/${shipmentId}/events`);
    if (response.success) {
      events.value = response.data;
    }
    return response;
  }

  function setFilters(newFilters: Record<string, string>) {
    filters.value = newFilters;
  }

  return {
    shipments,
    currentShipment,
    events,
    loading,
    pagination,
    filters,
    fetchShipments,
    fetchShipment,
    createShipment,
    updateShipment,
    transitionShipment,
    fetchEvents,
    setFilters,
  };
});
