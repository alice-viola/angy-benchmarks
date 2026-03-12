import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAxios } from '../composables/useAxios';
import type {
  VehicleResponse,
  VehicleRequest,
  VehicleUpdateRequest,
  PaginationMeta,
} from '@nexusfleet/shared';

export const useVehicleStore = defineStore('vehicles', () => {
  const vehicles = ref<VehicleResponse[]>([]);
  const currentVehicle = ref<VehicleResponse | null>(null);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({ page: 1, page_size: 25, total_items: 0, total_pages: 0 });

  async function list(params?: Record<string, unknown>) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get('/vehicles', { params });
      vehicles.value = res.data;
      pagination.value = res.meta;
    } finally {
      loading.value = false;
    }
  }

  async function fetch(id: string) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get(`/vehicles/${id}`);
      currentVehicle.value = res.data;
      return res.data as VehicleResponse;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: VehicleRequest) {
    const http = useAxios();
    const { data: res } = await http.post('/vehicles', data);
    return res.data as VehicleResponse;
  }

  async function update(id: string, data: VehicleUpdateRequest) {
    const http = useAxios();
    const { data: res } = await http.put(`/vehicles/${id}`, data);
    currentVehicle.value = res.data;
    return res.data as VehicleResponse;
  }

  async function remove(id: string) {
    const http = useAxios();
    await http.delete(`/vehicles/${id}`);
    vehicles.value = vehicles.value.filter((v) => v.id !== id);
  }

  return {
    vehicles,
    currentVehicle,
    loading,
    pagination,
    list,
    fetch,
    create,
    update,
    delete: remove,
  };
});
