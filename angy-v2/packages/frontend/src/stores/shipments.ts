import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAxios } from '../composables/useAxios';
import { useOptimisticUpdate } from '../composables/useOptimisticUpdate';
import type {
  ShipmentResponse,
  ShipmentRequest,
  ShipmentUpdateRequest,
  ShipmentTransitionRequest,
  ShipmentEventResponse,
  PaginationMeta,
} from '@nexusfleet/shared';

export const useShipmentStore = defineStore('shipments', () => {
  const shipments = ref<ShipmentResponse[]>([]);
  const currentShipment = ref<ShipmentResponse | null>(null);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({ page: 1, page_size: 25, total_items: 0, total_pages: 0 });
  const filters = ref<Record<string, string>>({});

  async function list(params?: Record<string, unknown>) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get('/shipments', { params });
      shipments.value = res.data;
      pagination.value = res.meta;
    } finally {
      loading.value = false;
    }
  }

  async function fetch(id: string) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get(`/shipments/${id}`);
      currentShipment.value = res.data;
      return res.data as ShipmentResponse;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: ShipmentRequest) {
    const http = useAxios();
    const { data: res } = await http.post('/shipments', data);
    return res.data as ShipmentResponse;
  }

  async function update(id: string, data: ShipmentUpdateRequest) {
    const http = useAxios();
    const { data: res } = await http.put(`/shipments/${id}`, data);
    currentShipment.value = res.data;
    return res.data as ShipmentResponse;
  }

  async function remove(id: string) {
    const http = useAxios();
    await http.delete(`/shipments/${id}`);
    shipments.value = shipments.value.filter((s) => s.id !== id);
  }

  async function transition(id: string, action: string, data?: ShipmentTransitionRequest['data']) {
    const shipment = shipments.value.find((s) => s.id === id) || currentShipment.value;
    const previousStatus = shipment?.status;

    await useOptimisticUpdate({
      apply: () => {
        // Optimistic status update
        if (shipment) {
          const statusMap: Record<string, string> = {
            confirm: 'confirmed',
            assign: 'assigned',
            pickup: 'in_transit',
            deliver: 'delivered',
            fail: 'failed',
            complete: 'completed',
            cancel: 'cancelled',
            retry: 'confirmed',
          };
          (shipment as Record<string, unknown>).status = statusMap[action] || shipment.status;
        }
      },
      revert: () => {
        if (shipment && previousStatus) {
          (shipment as Record<string, unknown>).status = previousStatus;
        }
      },
      apiCall: async () => {
        const http = useAxios();
        const { data: res } = await http.post(`/shipments/${id}/transition`, { action, data });
        // Update with actual server response
        if (currentShipment.value?.id === id) {
          currentShipment.value = res.data;
        }
        const idx = shipments.value.findIndex((s) => s.id === id);
        if (idx !== -1) {
          shipments.value[idx] = res.data;
        }
        return res.data;
      },
      errorMessage: `Failed to ${action} shipment`,
    });
  }

  async function fetchEvents(id: string): Promise<ShipmentEventResponse[]> {
    const http = useAxios();
    const { data: res } = await http.get(`/shipments/${id}/events`);
    return res.data;
  }

  return {
    shipments,
    currentShipment,
    loading,
    pagination,
    filters,
    list,
    fetch,
    create,
    update,
    delete: remove,
    transition,
    fetchEvents,
  };
});
