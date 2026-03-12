import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAxios } from '../composables/useAxios';
import type {
  RouteResponse,
  RouteRequest,
  RouteUpdateRequest,
  PaginationMeta,
} from '@nexusfleet/shared';

export interface OptimizationJob {
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  result: {
    stops: Array<{ id: string; sequence_order: number }>;
    estimated_distance_km: number;
    optimization_score: number;
  } | null;
}

export const useRouteStore = defineStore('routes', () => {
  const routes = ref<RouteResponse[]>([]);
  const currentRoute = ref<RouteResponse | null>(null);
  const loading = ref(false);
  const pagination = ref<PaginationMeta>({ page: 1, page_size: 25, total_items: 0, total_pages: 0 });
  const optimizationJobs = ref<Map<string, OptimizationJob>>(new Map());

  async function list(params?: Record<string, unknown>) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get('/routes', { params });
      routes.value = res.data;
      pagination.value = res.meta;
    } finally {
      loading.value = false;
    }
  }

  async function fetch(id: string) {
    loading.value = true;
    try {
      const http = useAxios();
      const { data: res } = await http.get(`/routes/${id}`);
      currentRoute.value = res.data;
      return res.data as RouteResponse;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: RouteRequest) {
    const http = useAxios();
    const { data: res } = await http.post('/routes', data);
    return res.data as RouteResponse;
  }

  async function update(id: string, data: RouteUpdateRequest) {
    const http = useAxios();
    const { data: res } = await http.put(`/routes/${id}`, data);
    currentRoute.value = res.data;
    return res.data as RouteResponse;
  }

  async function remove(id: string) {
    const http = useAxios();
    await http.delete(`/routes/${id}`);
    routes.value = routes.value.filter((r) => r.id !== id);
  }

  async function optimize(id: string): Promise<string> {
    const http = useAxios();
    const { data: res } = await http.post(`/routes/${id}/optimize`);
    const jobId = res.data.job_id as string;
    optimizationJobs.value.set(jobId, { status: 'pending', progress: 0, result: null });
    return jobId;
  }

  async function pollOptimization(id: string, jobId: string): Promise<OptimizationJob> {
    const http = useAxios();
    const { data: res } = await http.get(`/routes/${id}/optimize/${jobId}`);
    const job = res.data as OptimizationJob;
    optimizationJobs.value.set(jobId, job);

    if (job.status === 'pending' || job.status === 'active') {
      // Poll again after 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return pollOptimization(id, jobId);
    }

    return job;
  }

  async function reorderStops(id: string, stops: Array<{ id: string; sequence_order: number }>) {
    const http = useAxios();
    const { data: res } = await http.put(`/routes/${id}/stops`, { stops });
    currentRoute.value = res.data;
    return res.data as RouteResponse;
  }

  async function completeStop(
    id: string,
    stopId: string,
    podData?: { pod_signature_url?: string; pod_photo_urls?: string[]; pod_notes?: string }
  ) {
    const http = useAxios();
    const { data: res } = await http.post(`/routes/${id}/stops/${stopId}/complete`, podData || {});
    return res.data;
  }

  return {
    routes,
    currentRoute,
    loading,
    pagination,
    optimizationJobs,
    list,
    fetch,
    create,
    update,
    delete: remove,
    optimize,
    pollOptimization,
    reorderStops,
    completeStop,
  };
});
