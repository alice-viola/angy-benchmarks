<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useRouteStore } from '@/stores/route.store';
import { useToastStore } from '@/stores/toast.store';

const router = useRouter();
const store = useRouteStore();
const toast = useToastStore();

const name = ref('');
const notes = ref('');
const saving = ref(false);

async function onSubmit() {
  if (!name.value) {
    toast.show('Name is required', 'error');
    return;
  }
  saving.value = true;
  try {
    const route = await store.create({
      name: name.value,
      waypoints: [
        { latitude: 0, longitude: 0, order: 0 },
        { latitude: 0, longitude: 0, order: 1 },
      ],
      notes: notes.value || undefined,
    });
    router.push(`/routes/${route.id}/plan`);
  } catch {
    // error in store
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">New Route</h1>
    <div class="max-w-lg">
      <form @submit.prevent="onSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Route Name</label>
          <input v-model="name" type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea v-model="notes" rows="3"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" :disabled="saving"
          class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
          {{ saving ? 'Creating...' : 'Create Route' }}
        </button>
      </form>
    </div>
  </div>
</template>
