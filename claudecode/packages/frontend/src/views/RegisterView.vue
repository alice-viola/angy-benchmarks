<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { registerSchema } from '@nexus-fleet/shared';
import { useAuthStore } from '@/stores/auth';
import AuthLayout from '@/layouts/AuthLayout.vue';

const router = useRouter();
const authStore = useAuthStore();

const schema = toTypedSchema(registerSchema);
const { handleSubmit, errors } = useForm({ validationSchema: schema });

const { value: tenantName } = useField<string>('tenantName');
const { value: email } = useField<string>('email');
const { value: password } = useField<string>('password');
const { value: firstName } = useField<string>('firstName');
const { value: lastName } = useField<string>('lastName');

const loading = ref(false);
const errorMessage = ref('');

const onSubmit = handleSubmit(async (values) => {
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await authStore.register(values);
    if (response.success) {
      router.push('/dashboard');
    } else {
      errorMessage.value = response.error.message;
    }
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error?.message || 'Registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <AuthLayout>
    <h2 class="text-xl font-bold text-gray-900 mb-1">Create your account</h2>
    <p class="text-sm text-gray-500 mb-6">Start managing your fleet today</p>

    <div v-if="errorMessage" class="mb-4 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700">
      {{ errorMessage }}
    </div>

    <form @submit.prevent="onSubmit" class="space-y-4">
      <div>
        <label class="label">Organization Name</label>
        <input
          v-model="tenantName"
          type="text"
          class="input"
          :class="{ 'input-error': errors.tenantName }"
          placeholder="Your company name"
        />
        <p v-if="errors.tenantName" class="mt-1 text-xs text-danger-500">{{ errors.tenantName }}</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">First Name</label>
          <input
            v-model="firstName"
            type="text"
            class="input"
            :class="{ 'input-error': errors.firstName }"
            placeholder="John"
          />
          <p v-if="errors.firstName" class="mt-1 text-xs text-danger-500">{{ errors.firstName }}</p>
        </div>
        <div>
          <label class="label">Last Name</label>
          <input
            v-model="lastName"
            type="text"
            class="input"
            :class="{ 'input-error': errors.lastName }"
            placeholder="Doe"
          />
          <p v-if="errors.lastName" class="mt-1 text-xs text-danger-500">{{ errors.lastName }}</p>
        </div>
      </div>

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
          placeholder="Min 8 chars, upper, lower, number, special"
          autocomplete="new-password"
        />
        <p v-if="errors.password" class="mt-1 text-xs text-danger-500">{{ errors.password }}</p>
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? 'Creating account...' : 'Create account' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-gray-500">
      Already have an account?
      <router-link to="/login" class="font-medium text-primary-600 hover:text-primary-500">
        Sign in
      </router-link>
    </p>
  </AuthLayout>
</template>
