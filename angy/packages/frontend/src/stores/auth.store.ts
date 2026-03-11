import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Role } from '@nexus-fleet/shared';
import { api } from '@/plugins/axios';
import { useToastStore } from './toast.store';

export interface AuthUser {
  id: string;
  tenant_id: string;
  email: string;
  role: Role;
  first_name: string;
  last_name: string;
}

export interface AuthTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const user = ref<AuthUser | null>(null);
  const tenant = ref<AuthTenant | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);
  const canManageUsers = computed(
    () => !!user.value && (user.value.role === 'owner' || user.value.role === 'admin'),
  );
  const canManageShipments = computed(
    () =>
      !!user.value &&
      (user.value.role === 'owner' ||
        user.value.role === 'admin' ||
        user.value.role === 'dispatcher'),
  );
  const canViewOnly = computed(() => !!user.value && user.value.role === 'viewer');
  const userFullName = computed(() =>
    user.value ? `${user.value.first_name} ${user.value.last_name}` : '',
  );

  async function login(email: string, password: string) {
    const toast = useToastStore();
    try {
      const res = await api.post('/api/v1/auth/login', { email, password });
      accessToken.value = res.data.data.access_token;
      user.value = res.data.data.user;
      tenant.value = res.data.data.tenant;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed';
      toast.show(message, 'error');
      throw err;
    }
  }

  async function register(
    tenant_name: string,
    email: string,
    password: string,
    first_name: string,
    last_name: string,
  ) {
    const toast = useToastStore();
    try {
      const res = await api.post('/api/v1/auth/register', {
        tenant_name,
        email,
        password,
        first_name,
        last_name,
      });
      accessToken.value = res.data.data.access_token;
      user.value = res.data.data.user;
      tenant.value = res.data.data.tenant;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed';
      toast.show(message, 'error');
      throw err;
    }
  }

  async function logout() {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // ignore logout errors
    }
    accessToken.value = null;
    user.value = null;
    tenant.value = null;
  }

  async function refreshToken() {
    const res = await api.post('/api/v1/auth/refresh');
    accessToken.value = res.data.data.access_token;
    return res.data.data.access_token as string;
  }

  async function fetchMe() {
    try {
      const res = await api.get('/api/v1/auth/me');
      accessToken.value = res.data.data.access_token;
      user.value = res.data.data.user;
      tenant.value = res.data.data.tenant;
    } catch {
      accessToken.value = null;
      user.value = null;
      tenant.value = null;
    }
  }

  return {
    accessToken,
    user,
    tenant,
    isAuthenticated,
    canManageUsers,
    canManageShipments,
    canViewOnly,
    userFullName,
    login,
    register,
    logout,
    refreshToken,
    fetchMe,
  };
});
