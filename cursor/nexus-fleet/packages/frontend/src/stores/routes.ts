import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type {
  Route,
  CreateRouteInput,
  UpdateRouteInput,
  RouteFilterParams,
  RouteStop,
} from '@nexus-fleet/shared';
import { useApi } from '../composables/useApi';
import { useToast } from '../composables/useToast';

export const useRouteStore = defineStore('routes', () => {
  const api = useApi();
  const toast = useToast();

  const routes = ref<Route[]>([]);
  const currentRoute = ref<Route | null>(null);
  const loading = ref(false);
  const optimizationJobId = ref<string | null>(null);
  const optimizationStatus = ref<string | null>(null);
  const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  async function fetchRoutes(params?: Partial<RouteFilterParams>) {
    loading.value = true;
    try {
      const query = { ...params, page: params?.page ?? pagination.page, limit: params?.limit ?? pagination.pageSize };
      const { data: res } = await api.get('/routes', { params: query });
      routes.value = res.data;
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

  async function fetchRoute(id: string) {
    loading.value = true;
    try {
      const { data: res } = await api.get(`/routes/${id}`);
      currentRoute.value = res.data;
      return res.data as Route;
    } finally {
      loading.value = false;
    }
  }

  async function createRoute(data: CreateRouteInput) {
    loading.value = true;
    try {
      const { data: res } = await api.post('/routes', data);
      routes.value.unshift(res.data);
      toast.success('Route created');
      return res.data as Route;
    } finally {
      loading.value = false;
    }
  }

  async function updateRoute(id: string, data: UpdateRouteInput) {
    loading.value = true;
    try {
      const { data: res } = await api.patch(`/routes/${id}`, data);
      const idx = routes.value.findIndex((r) => r.id === id);
      if (idx !== -1) routes.value[idx] = res.data;
      if (currentRoute.value?.id === id) currentRoute.value = res.data;
      toast.success('Route updated');
      return res.data as Route;
    } finally {
      loading.value = false;
    }
  }

  async function deleteRoute(id: string) {
    loading.value = true;
    try {
      await api.delete(`/routes/${id}`);
      routes.value = routes.value.filter((r) => r.id !== id);
      if (currentRoute.value?.id === id) currentRoute.value = null;
      toast.success('Route deleted');
    } finally {
      loading.value = false;
    }
  }

  async function optimizeRoute(id: string) {
    loading.value = true;
    optimizationStatus.value = 'pending';
    try {
      const { data: res } = await api.post(`/routes/${id}/optimize`);
      optimizationJobId.value = res.data.jobId;
      optimizationStatus.value = 'processing';
      toast.info('Route optimization started');
      return res.data.jobId as string;
    } catch {
      optimizationStatus.value = 'failed';
      throw new Error('Optimization request failed');
    } finally {
      loading.value = false;
    }
  }

  async function pollOptimization(routeId: string, jobId: string): Promise<Route> {
    const maxAttempts = 30;
    const intervalMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data: res } = await api.get(`/routes/${routeId}/optimize/${jobId}`);
      optimizationStatus.value = res.data.status;

      if (res.data.status === 'completed') {
        optimizationJobId.value = null;
        optimizationStatus.value = null;
        await fetchRoute(routeId);
        toast.success('Route optimized');
        return currentRoute.value!;
      }

      if (res.data.status === 'failed') {
        optimizationJobId.value = null;
        optimizationStatus.value = 'failed';
        toast.error('Route optimization failed');
        throw new Error('Optimization failed');
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    optimizationStatus.value = 'timeout';
    throw new Error('Optimization polling timed out');
  }

  async function updateStopOrder(routeId: string, stops: Array<{ id: string; sequence: number }>) {
    loading.value = true;
    try {
      const { data: res } = await api.patch(`/routes/${routeId}/stops/reorder`, { stops });
      if (currentRoute.value?.id === routeId) currentRoute.value = res.data;
      toast.success('Stop order updated');
      return res.data as Route;
    } finally {
      loading.value = false;
    }
  }

  async function completeStop(routeId: string, stopId: string) {
    loading.value = true;
    try {
      const { data: res } = await api.post(`/routes/${routeId}/stops/${stopId}/complete`);
      if (currentRoute.value?.id === routeId && currentRoute.value.stops) {
        const idx = currentRoute.value.stops.findIndex((s: RouteStop) => s.id === stopId);
        if (idx !== -1) currentRoute.value.stops[idx] = res.data;
      }
      toast.success('Stop completed');
      return res.data as RouteStop;
    } finally {
      loading.value = false;
    }
  }

  return {
    routes,
    currentRoute,
    loading,
    optimizationJobId,
    optimizationStatus,
    pagination,
    fetchRoutes,
    fetchRoute,
    createRoute,
    updateRoute,
    deleteRoute,
    optimizeRoute,
    pollOptimization,
    updateStopOrder,
    completeStop,
  };
});
