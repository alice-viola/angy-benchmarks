<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import ToastContainer from '@/components/common/ToastContainer.vue';

const route = useRoute();
const layout = computed(() => (route.meta.layout === 'auth' ? AuthLayout : DefaultLayout));
</script>

<template>
  <component :is="layout">
    <router-view />
  </component>
  <ToastContainer />
</template>
