<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGeofencesStore } from '@/stores/geofences';
import AppLayout from '@/layouts/AppLayout.vue';
import GeofenceEditor from '@/components/map/GeofenceEditor.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

const route = useRoute();
const router = useRouter();
const geofencesStore = useGeofencesStore();

const geofenceId = route.params.id as string | undefined;
const isEditing = !!geofenceId;

async function handleSave(data: any) {
  if (isEditing && geofenceId) {
    await geofencesStore.updateGeofence(geofenceId, data);
  } else {
    await geofencesStore.createGeofence(data);
  }
  router.push('/geofences');
}

onMounted(() => {
  if (isEditing && geofenceId) {
    geofencesStore.fetchGeofence(geofenceId);
  }
});
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="p-1 text-gray-400 hover:text-gray-600" @click="router.back()">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 class="page-title">{{ isEditing ? 'Edit Geofence' : 'New Geofence' }}</h1>
      </div>
    </div>

    <div v-if="isEditing && geofencesStore.loading && !geofencesStore.currentGeofence" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <GeofenceEditor
      v-else
      :geofence="isEditing ? geofencesStore.currentGeofence : null"
      @save="handleSave"
      @cancel="router.back()"
    />
  </AppLayout>
</template>
