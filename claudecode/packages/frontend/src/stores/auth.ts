import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi, setAccessToken } from '@/composables/useApi';
import type { LoginInput, RegisterInput } from '@nexus-fleet/shared';
import type { User } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const api = useApi();

  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

  async function login(credentials: LoginInput) {
    const response = await api.post<{ user: User; accessToken: string }>(
      '/auth/login',
      credentials,
    );
    if (response.success) {
      user.value = response.data.user;
      accessToken.value = response.data.accessToken;
      setAccessToken(response.data.accessToken);
    }
    return response;
  }

  async function register(input: RegisterInput) {
    const response = await api.post<{ user: User; accessToken: string }>(
      '/auth/register',
      input,
    );
    if (response.success) {
      user.value = response.data.user;
      accessToken.value = response.data.accessToken;
      setAccessToken(response.data.accessToken);
    }
    return response;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      user.value = null;
      accessToken.value = null;
      setAccessToken(null);
    }
  }

  async function refreshToken() {
    try {
      const response = await api.post<{ accessToken: string }>('/auth/refresh');
      if (response.success) {
        accessToken.value = response.data.accessToken;
        setAccessToken(response.data.accessToken);
        return true;
      }
    } catch {
      // Refresh failed
    }
    return false;
  }

  async function fetchMe() {
    const response = await api.get<User>('/auth/me');
    if (response.success) {
      user.value = response.data;
    }
    return response;
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    login,
    register,
    logout,
    refreshToken,
    fetchMe,
  };
});
