import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

let instance: AxiosInstance | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      resolve(instance!.request(config));
    }
  });
  failedQueue = [];
}

export function useAxios() {
  if (instance) return instance;

  instance = axios.create({
    baseURL: '/api/v1',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor — attach token
  instance.interceptors.request.use((config) => {
    // Dynamically import to avoid circular dependency at module load
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor — handle 401
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/refresh') &&
        !originalRequest.url?.includes('/auth/login')
      ) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject, config: originalRequest });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshResponse = await instance!.post('/auth/refresh');
          const newToken = refreshResponse.data.data.access_token;
          setStoredToken(newToken);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return instance!.request(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          clearStoredToken();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

// Simple token storage helpers using a module-level variable
// The auth store will also call these to keep in sync
let _accessToken: string | null = null;

export function getStoredToken(): string | null {
  return _accessToken;
}

export function setStoredToken(token: string | null) {
  _accessToken = token;
}

export function clearStoredToken() {
  _accessToken = null;
}
