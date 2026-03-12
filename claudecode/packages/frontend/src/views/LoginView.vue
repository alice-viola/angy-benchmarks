<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { loginSchema } from '@nexus-fleet/shared';
import { useAuthStore } from '@/stores/auth';
import AuthLayout from '@/layouts/AuthLayout.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const schema = toTypedSchema(loginSchema);
const { handleSubmit, errors } = useForm({ validationSchema: schema });

const { value: email } = useField<string>('email');
const { value: password } = useField<string>('password');

const loading = ref(false);
const errorMessage = ref('');

const onSubmit = handleSubmit(async (values) => {
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await authStore.login(values);
    if (response.success) {
      const redirect = (route.query.redirect as string) || '/dashboard';
      router.push(redirect);
    } else {
      errorMessage.value = response.error.message;
    }
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error?.message || 'Login failed. Please try again.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <AuthLayout>
    <h2 class="text-xl font-bold text-gray-900 mb-1">Welcome back</h2>
    <p class="text-sm text-gray-500 mb-6">Sign in to your account</p>

    <div v-if="errorMessage" class="mb-4 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700">
      {{ errorMessage }}
    </div>

    <form @submit.prevent="onSubmit" class="space-y-4">
      <div>
        <label class="label">Email</label>
        <input
          v-model="email"
          type="email"
          class="input"
          :class="{ 'input-error': errors.email }"
          placeholder="you@company.com"
          autocomplete="email"
        />
        <p v-if="errors.email" class="mt-1 text-xs text-danger-500">{{ errors.email }}</p>
      </div>

      <div>
        <label class="label">Password</label>
        <input
          v-model="password"
          type="password"
          class="input"
          :class="{ 'input-error': errors.password }"
          placeholder="Enter your password"
          autocomplete="current-password"
        />
        <p v-if="errors.password" class="mt-1 text-xs text-danger-500">{{ errors.password }}</p>
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-gray-500">
      Don't have an account?
      <router-link to="/register" class="font-medium text-primary-600 hover:text-primary-500">
        Create one
      </router-link>
    </p>
  </AuthLayout>
</template>
