import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAxios, setStoredToken, clearStoredToken } from '../composables/useAxios';
import type { MeResponse, LoginResponse, RegisterResponse } from '@nexusfleet/shared';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<LoginResponse['user'] | MeResponse | null>(null);
  const tenant = ref<{ id: string; name: string; slug: string; plan?: string } | null>(null);
  const accessToken = ref<string | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

  async function login(email: string, password: string) {
    const http = useAxios();
    const { data: res } = await http.post<{ success: true; data: LoginResponse }>('/auth/login', {
      email,
      password,
    });
    const { user: u, access_token } = res.data;
    user.value = u;
    accessToken.value = access_token;
    setStoredToken(access_token);
    // Fetch full user with tenant info
    await fetchMe();
  }

  async function register(data: {
    tenant_name: string;
    tenant_slug: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) {
    const http = useAxios();
    const { data: res } = await http.post<{ success: true; data: RegisterResponse }>(
      '/auth/register',
      data
    );
    const { user: u, tenant: t, access_token } = res.data;
    user.value = { ...u, tenant_id: t.id };
    tenant.value = t;
    accessToken.value = access_token;
    setStoredToken(access_token);
  }

  async function logout() {
    try {
      const http = useAxios();
      await http.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    } finally {
      user.value = null;
      tenant.value = null;
      accessToken.value = null;
      clearStoredToken();
    }
  }

  async function refresh() {
    try {
      const http = useAxios();
      const { data: res } = await http.post<{ success: true; data: { access_token: string } }>(
        '/auth/refresh'
      );
      accessToken.value = res.data.access_token;
      setStoredToken(res.data.access_token);
    } catch {
      user.value = null;
      tenant.value = null;
      accessToken.value = null;
      clearStoredToken();
      throw new Error('Session expired');
    }
  }

  async function fetchMe() {
    const http = useAxios();
    const { data: res } = await http.get<{ success: true; data: MeResponse }>('/auth/me');
    user.value = res.data;
    tenant.value = res.data.tenant;
  }

  return {
    user,
    tenant,
    accessToken,
    isAuthenticated,
    login,
    register,
    logout,
    refresh,
    fetchMe,
  };
});
