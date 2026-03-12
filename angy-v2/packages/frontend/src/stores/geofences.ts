import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAxios } from '../composables/useAxios';
import type {
  GeofenceResponse,
  GeofenceRequest,
  GeofenceUpdateRequest,
  PaginationMeta,
} from '@nexusfleet/shared';

export const useGeofenceStore = defineStore('geofences', () => {
  const geofences = ref<GeofenceResponse[]>([]);
  const currentGeofence = ref<GeofenceResponse | null>(null);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({ page: 1, page_size: 25, total_items: 0, total_pages: 0 });

  async function list(params?: Record<string, unknown>) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get('/geofences', { params });
      geofences.value = res.data;
      pagination.value = res.meta;
    } finally {
      loading.value = false;
    }
  }

  async function fetch(id: string) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get(`/geofences/${id}`);
      currentGeofence.value = res.data;
      return res.data as GeofenceResponse;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: GeofenceRequest) {
    const http = useAxios();
    const { data: res } = await http.post('/geofences', data);
    return res.data as GeofenceResponse;
  }

  async function update(id: string, data: GeofenceUpdateRequest) {
    const http = useAxios();
    const { data: res } = await http.put(`/geofences/${id}`, data);
    currentGeofence.value = res.data;
    return res.data as GeofenceResponse;
  }

  async function remove(id: string) {
    const http = useAxios();
    await http.delete(`/geofences/${id}`);
    geofences.value = geofences.value.filter((g) => g.id !== id);
  }

  return {
    geofences,
    currentGeofence,
    loading,
    pagination,
    list,
    fetch,
    create,
    update,
    delete: remove,
  };
});
