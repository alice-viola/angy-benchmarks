import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, RegisterInput } from '@nexus-fleet/shared';
import { useApi } from '../composables/useApi';
import { useToast } from '../composables/useToast';

export const useAuthStore = defineStore('auth', () => {
  const api = useApi();
  const toast = useToast();

  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem('access_token'));
  const loading = ref(false);

  const isAuthenticated = computed(() => !!accessToken.value);

  async function login(email: string, password: string) {
    loading.value = true;
    try {
      const { data: res } = await api.post('/auth/login', { email, password });
      accessToken.value = res.data.accessToken;
      localStorage.setItem('access_token', res.data.accessToken);
      if (res.data.refreshToken) {
        localStorage.setItem('refresh_token', res.data.refreshToken);
      }
      await fetchMe();
      toast.success('Logged in successfully');
    } catch {
      accessToken.value = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      throw new Error('Login failed');
    } finally {
      loading.value = false;
    }
  }

  async function register(input: RegisterInput) {
    loading.value = true;
    try {
      const { data: res } = await api.post('/auth/register', input);
      accessToken.value = res.data.accessToken;
      localStorage.setItem('access_token', res.data.accessToken);
      if (res.data.refreshToken) {
        localStorage.setItem('refresh_token', res.data.refreshToken);
      }
      await fetchMe();
      toast.success('Account created successfully');
    } catch {
      throw new Error('Registration failed');
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    user.value = null;
    accessToken.value = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async function refreshToken() {
    try {
      const refresh = localStorage.getItem('refresh_token');
      const { data: res } = await api.post('/auth/refresh', { refreshToken: refresh });
      accessToken.value = res.data.accessToken;
      localStorage.setItem('access_token', res.data.accessToken);
      if (res.data.refreshToken) {
        localStorage.setItem('refresh_token', res.data.refreshToken);
      }
    } catch {
      logout();
      throw new Error('Token refresh failed');
    }
  }

  async function fetchMe() {
    try {
      const { data: res } = await api.get('/auth/me');
      user.value = res.data;
    } catch {
      user.value = null;
    }
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    refreshToken,
    fetchMe,
  };
});
