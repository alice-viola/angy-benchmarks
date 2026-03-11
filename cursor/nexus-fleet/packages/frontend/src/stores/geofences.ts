import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  Geofence,
  CreateGeofenceInput,
  UpdateGeofenceInput,
  GeofenceEvent,
} from '@nexus-fleet/shared';
import { useApi } from '../composables/useApi';
import { useToast } from '../composables/useToast';

export const useGeofenceStore = defineStore('geofences', () => {
  const api = useApi();
  const toast = useToast();

  const geofences = ref<Geofence[]>([]);
  const currentGeofence = ref<Geofence | null>(null);
  const loading = ref(false);

  async function fetchGeofences() {
    loading.value = true;
    try {
      const { data: res } = await api.get('/geofences');
      geofences.value = res.data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchGeofence(id: string) {
    loading.value = true;
    try {
      const { data: res } = await api.get(`/geofences/${id}`);
      currentGeofence.value = res.data;
      return res.data as Geofence;
    } finally {
      loading.value = false;
    }
  }

  async function createGeofence(data: CreateGeofenceInput) {
    loading.value = true;
    try {
      const { data: res } = await api.post('/geofences', data);
      geofences.value.unshift(res.data);
      toast.success('Geofence created');
      return res.data as Geofence;
    } finally {
      loading.value = false;
    }
  }

  async function updateGeofence(id: string, data: UpdateGeofenceInput) {
    loading.value = true;
    try {
      const { data: res } = await api.patch(`/geofences/${id}`, data);
      const idx = geofences.value.findIndex((g) => g.id === id);
      if (idx !== -1) geofences.value[idx] = res.data;
      if (currentGeofence.value?.id === id) currentGeofence.value = res.data;
      toast.success('Geofence updated');
      return res.data as Geofence;
    } finally {
      loading.value = false;
    }
  }

  async function deleteGeofence(id: string) {
    loading.value = true;
    try {
      await api.delete(`/geofences/${id}`);
      geofences.value = geofences.value.filter((g) => g.id !== id);
      if (currentGeofence.value?.id === id) currentGeofence.value = null;
      toast.success('Geofence deleted');
    } finally {
      loading.value = false;
    }
  }

  async function fetchEvents(geofenceId: string) {
    const { data: res } = await api.get(`/geofences/${geofenceId}/events`);
    return res.data as GeofenceEvent[];
  }

  return {
    geofences,
    currentGeofence,
    loading,
    fetchGeofences,
    fetchGeofence,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    fetchEvents,
  };
});
