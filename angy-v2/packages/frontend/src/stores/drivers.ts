import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAxios } from '../composables/useAxios';
import type {
  DriverResponse,
  DriverRequest,
  DriverUpdateRequest,
  PaginationMeta,
} from '@nexusfleet/shared';

export const useDriverStore = defineStore('drivers', () => {
  const drivers = ref<DriverResponse[]>([]);
  const currentDriver = ref<DriverResponse | null>(null);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({ page: 1, page_size: 25, total_items: 0, total_pages: 0 });

  async function list(params?: Record<string, unknown>) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get('/drivers', { params });
      drivers.value = res.data;
      pagination.value = res.meta;
    } finally {
      loading.value = false;
    }
  }

  async function fetch(id: string) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get(`/drivers/${id}`);
      currentDriver.value = res.data;
      return res.data as DriverResponse;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: DriverRequest) {
    const http = useAxios();
    const { data: res } = await http.post('/drivers', data);
    return res.data as DriverResponse;
  }

  async function update(id: string, data: DriverUpdateRequest) {
    const http = useAxios();
    const { data: res } = await http.put(`/drivers/${id}`, data);
    currentDriver.value = res.data;
    return res.data as DriverResponse;
  }

  async function remove(id: string) {
    const http = useAxios();
    await http.delete(`/drivers/${id}`);
    drivers.value = drivers.value.filter((d) => d.id !== id);
  }

  async function assignVehicle(driverId: string, vehicleId: string) {
    const http = useAxios();
    const { data: res } = await http.post(`/drivers/${driverId}/assign-vehicle`, {
      vehicle_id: vehicleId,
    });
    currentDriver.value = res.data;
    return res.data as DriverResponse;
  }

  async function unassignVehicle(driverId: string) {
    const http = useAxios();
    const { data: res } = await http.post(`/drivers/${driverId}/unassign-vehicle`);
    currentDriver.value = res.data;
    return res.data as DriverResponse;
  }

  return {
    drivers,
    currentDriver,
    loading,
    pagination,
    list,
    fetch,
    create,
    update,
    delete: remove,
    assignVehicle,
    unassignVehicle,
  };
});
