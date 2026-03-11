import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/plugins/axios';
import { useToastStore } from './toast.store';
import type { CreateRouteInput, UpdateRouteInput } from '@nexus-fleet/shared';

export interface RouteStop {
  id: string;
  route_id: string;
  shipment_id: string | null;
  shipment?: { id: string; reference_code: string };
  stop_type: string;
  address: string;
  latitude: number;
  longitude: number;
  sequence: number;
  status: string;
  arrival_time: string | null;
  completed_at: string | null;
}

export interface Route {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  driver_id: string | null;
  vehicle_id: string | null;
  driver?: { id: string; first_name: string; last_name: string } | null;
  vehicle?: { id: string; registration: string; capacity_kg: string | null } | null;
  waypoints: Array<{ latitude: number; longitude: number; address?: string; order: number }>;
  stops?: RouteStop[];
  scheduled_start_at: string | null;
  estimated_distance_km: number | null;
  notes: string | null;
  planned_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteFilters {
  status?: string;
  driver_id?: string;
  vehicle_id?: string;
  page: number;
  limit: number;
}

export interface OptimizeJob {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  result?: unknown;
}

export const useRouteStore = defineStore('route', () => {
  const toast = useToastStore();
  const routes = ref<Route[]>([]);
  const currentRoute = ref<Route | null>(null);
  const totalItems = ref(0);
  const loading = ref(false);
  const filters = ref<RouteFilters>({ page: 1, limit: 20 });
  const optimizeJob = ref<OptimizeJob | null>(null);

  async function fetchList(params?: Partial<RouteFilters>) {
    loading.value = true;
    try {
      if (params) Object.assign(filters.value, params);
      const res = await api.get('/api/v1/routes', { params: filters.value });
      routes.value = res.data.data;
      totalItems.value = res.data.meta?.totalItems ?? res.data.data.length;
    } catch (err) {
      toast.show('Failed to load routes', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: string) {
    loading.value = true;
    try {
      const res = await api.get(`/api/v1/routes/${id}`);
      currentRoute.value = res.data.data ?? res.data;
      return currentRoute.value;
    } catch (err) {
      toast.show('Failed to load route', 'error');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: CreateRouteInput) {
    try {
      const res = await api.post('/api/v1/routes', data);
      toast.show('Route created', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to create route', 'error');
      throw err;
    }
  }

  async function update(id: string, data: UpdateRouteInput) {
    try {
      const res = await api.patch(`/api/v1/routes/${id}`, data);
      toast.show('Route updated', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to update route', 'error');
      throw err;
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/v1/routes/${id}`);
      toast.show('Route deleted', 'success');
    } catch (err) {
      toast.show('Failed to delete route', 'error');
      throw err;
    }
  }

  async function optimize(routeId: string) {
    try {
      const res = await api.post(`/api/v1/routes/${routeId}/optimize`);
      const job = res.data.data ?? res.data;
      optimizeJob.value = { id: job.job_id ?? job.id, status: 'waiting' };
      pollOptimizeJob(routeId, optimizeJob.value.id);
      return optimizeJob.value;
    } catch (err) {
      toast.show('Failed to start optimization', 'error');
      throw err;
    }
  }

  function pollOptimizeJob(routeId: string, jobId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/v1/routes/${routeId}/optimize/${jobId}`);
        const job = res.data.data ?? res.data;
        optimizeJob.value = {
          id: jobId,
          status: job.status,
          progress: job.progress,
          result: job.result,
        };
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(interval);
          if (job.status === 'completed') {
            toast.show('Route optimized', 'success');
            fetchOne(routeId);
          } else {
            toast.show('Optimization failed', 'error');
          }
        }
      } catch {
        clearInterval(interval);
        optimizeJob.value = null;
      }
    }, 2000);
  }

  async function completeStop(routeId: string, stopId: string) {
    try {
      const res = await api.post(`/api/v1/routes/${routeId}/stops/${stopId}/complete`);
      toast.show('Stop completed', 'success');
      return res.data.data ?? res.data;
    } catch (err) {
      toast.show('Failed to complete stop', 'error');
      throw err;
    }
  }

  return {
    routes,
    currentRoute,
    totalItems,
    loading,
    filters,
    optimizeJob,
    fetchList,
    fetchOne,
    create,
    update,
    remove,
    optimize,
    completeStop,
  };
});
