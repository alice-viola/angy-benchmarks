import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '@/composables/useApi';
import type { PaginationMeta, RouteCreateInput } from '@nexus-fleet/shared';
import type { Route } from '@/types';

export const useRoutesStore = defineStore('routes', () => {
  const api = useApi();

  const routes = ref<Route[]>([]);
  const currentRoute = ref<Route | null>(null);
  const loading = ref(false);
  const optimizing = ref(false);
  const pagination = ref<PaginationMeta>({
    page: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0,
  });

  async function fetchRoutes(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) {
    loading.value = true;
    try {
      const response = await api.get<Route[]>('/routes', { params });
      if (response.success) {
        routes.value = response.data;
        if (response.meta) {
          pagination.value = response.meta;
        }
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchRoute(id: string) {
    loading.value = true;
    try {
      const response = await api.get<Route>(`/routes/${id}`);
      if (response.success) {
        currentRoute.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createRoute(input: RouteCreateInput) {
    const response = await api.post<Route>('/routes', input);
    if (response.success) {
      routes.value.unshift(response.data);
    }
    return response;
  }

  async function updateRoute(id: string, input: Partial<RouteCreateInput>) {
    const response = await api.put<Route>(`/routes/${id}`, input);
    if (response.success) {
      const index = routes.value.findIndex((r) => r.id === id);
      if (index !== -1) {
        routes.value[index] = response.data;
      }
      if (currentRoute.value?.id === id) {
        currentRoute.value = response.data;
      }
    }
    return response;
  }

  async function deleteRoute(id: string) {
    const response = await api.del(`/routes/${id}`);
    if (response.success) {
      routes.value = routes.value.filter((r) => r.id !== id);
      if (currentRoute.value?.id === id) {
        currentRoute.value = null;
      }
    }
    return response;
  }

  async function optimizeRoute(id: string) {
    optimizing.value = true;
    try {
      const response = await api.post<{ jobId: string }>(`/routes/${id}/optimize`);
      if (response.success) {
        // Start polling for optimization completion
        await pollOptimizationJob(id, response.data.jobId);
      }
      return response;
    } finally {
      optimizing.value = false;
    }
  }

  async function pollOptimizationJob(routeId: string, jobId: string): Promise<void> {
    const maxAttempts = 60;
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        attempts++;
        if (attempts > maxAttempts) {
          reject(new Error('Optimization timeout'));
          return;
        }

        try {
          const response = await api.get<{ status: string; route?: Route }>(
            `/routes/${routeId}/optimize/${jobId}`,
          );
          if (response.success) {
            if (response.data.status === 'completed' && response.data.route) {
              currentRoute.value = response.data.route;
              const index = routes.value.findIndex((r) => r.id === routeId);
              if (index !== -1) {
                routes.value[index] = response.data.route;
              }
              resolve();
              return;
            } else if (response.data.status === 'failed') {
              reject(new Error('Optimization failed'));
              return;
            }
          }
        } catch {
          // Continue polling on transient errors
        }

        setTimeout(poll, 2000);
      };

      poll();
    });
  }

  return {
    routes,
    currentRoute,
    loading,
    optimizing,
    pagination,
    fetchRoutes,
    fetchRoute,
    createRoute,
    updateRoute,
    deleteRoute,
    optimizeRoute,
  };
});
