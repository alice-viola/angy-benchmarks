<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { loginRequestSchema } from '@nexusfleet/shared';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { addToast } = useToast();

const showPassword = ref(false);
const submitting = ref(false);
const apiError = ref('');

const { handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(loginRequestSchema),
});

const { value: email } = useField<string>('email');
const { value: password } = useField<string>('password');

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true;
  apiError.value = '';
  try {
    await authStore.login(values.email, values.password);
    addToast({ type: 'success', title: 'Welcome back!', message: 'Successfully signed in' });
    const redirect = (route.query.redirect as string) || '/dashboard';
    router.push(redirect);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: { message?: string } } } };
    apiError.value = error.response?.data?.error?.message || 'Invalid email or password';
  } finally {
    submitting.value = false;
  }
});
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold text-neutral-800 text-center mb-1">Sign in to your account</h2>
    <p class="text-sm text-neutral-400 text-center mb-6">Enter your credentials to access the dashboard</p>

    <!-- API error banner -->
    <div
      v-if="apiError"
      class="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 flex items-center gap-3 mb-5"
    >
      <AlertCircle class="w-4 h-4 text-danger-500 flex-shrink-0" />
      <p class="text-sm text-danger-700">{{ apiError }}</p>
    </div>

    <form class="space-y-5" @submit.prevent="onSubmit">
      <!-- Email -->
      <div>
        <label class="text-sm font-medium text-neutral-700 mb-1.5 block">
          Email <span class="text-danger-500">*</span>
        </label>
        <input
          v-model="email"
          type="email"
          placeholder="you@company.com"
          autocomplete="email"
          :class="[
            'w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
            errors.email ? 'border-danger-500 focus:border-danger-500' : 'border-neutral-300 focus:border-primary-500',
          ]"
        />
        <p v-if="errors.email" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
          <AlertCircle class="w-3.5 h-3.5" />
          {{ errors.email }}
        </p>
      </div>

      <!-- Password -->
      <div>
        <label class="text-sm font-medium text-neutral-700 mb-1.5 block">
          Password <span class="text-danger-500">*</span>
        </label>
        <div class="relative">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter your password"
            autocomplete="current-password"
            :class="[
              'w-full h-10 bg-white border rounded-lg px-3 pr-10 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              errors.password ? 'border-danger-500 focus:border-danger-500' : 'border-neutral-300 focus:border-primary-500',
            ]"
          />
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="w-4 h-4" />
            <Eye v-else class="w-4 h-4" />
          </button>
        </div>
        <p v-if="errors.password" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
          <AlertCircle class="w-3.5 h-3.5" />
          {{ errors.password }}
        </p>
      </div>

      <!-- Submit -->
      <button
        type="submit"
        :disabled="submitting"
        class="w-full bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
        <span>{{ submitting ? 'Signing in...' : 'Sign in' }}</span>
      </button>
    </form>

    <p class="text-sm text-neutral-400 text-center mt-6">
      Don't have an account?
      <RouterLink to="/register" class="text-primary-500 hover:text-primary-600 font-medium">
        Create one
      </RouterLink>
    </p>
  </div>
</template>
