<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from './layouts/AppLayout.vue';
import AuthLayout from './layouts/AuthLayout.vue';
import Toast from './components/common/Toast.vue';

const route = useRoute();
const layout = computed(() => route.meta.layout as string || 'app');
</script>

<template>
  <component :is="layout === 'auth' ? AuthLayout : AppLayout">
    <RouterView />
  </component>
  <Toast />
</template>
