<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { registerRequestSchema } from '@nexusfleet/shared';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';

const router = useRouter();
const authStore = useAuthStore();
const { addToast } = useToast();

const showPassword = ref(false);
const submitting = ref(false);
const apiError = ref('');

const { handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(registerRequestSchema),
});

const { value: tenantName } = useField<string>('tenant_name');
const { value: tenantSlug } = useField<string>('tenant_slug');
const { value: email } = useField<string>('email');
const { value: password } = useField<string>('password');
const { value: firstName } = useField<string>('first_name');
const { value: lastName } = useField<string>('last_name');

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true;
  apiError.value = '';
  try {
    await authStore.register(values);
    addToast({ type: 'success', title: 'Account created!', message: 'Welcome to NexusFleet' });
    router.push('/dashboard');
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: { message?: string } } } };
    apiError.value = error.response?.data?.error?.message || 'Registration failed';
  } finally {
    submitting.value = false;
  }
});
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold text-neutral-800 text-center mb-1">Create your account</h2>
    <p class="text-sm text-neutral-400 text-center mb-6">Set up your organization and get started</p>

    <div
      v-if="apiError"
      class="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 flex items-center gap-3 mb-5"
    >
      <AlertCircle class="w-4 h-4 text-danger-500 flex-shrink-0" />
      <p class="text-sm text-danger-700">{{ apiError }}</p>
    </div>

    <form class="space-y-5" @submit.prevent="onSubmit">
      <!-- Organization -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-5">
        <div>
          <label class="text-sm font-medium text-neutral-700 mb-1.5 block">
            Organization Name <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="tenantName"
            type="text"
            placeholder="Acme Logistics"
            :class="[
              'w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              errors.tenant_name ? 'border-danger-500' : 'border-neutral-300 focus:border-primary-500',
            ]"
          />
          <p v-if="errors.tenant_name" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />{{ errors.tenant_name }}
          </p>
        </div>
        <div>
          <label class="text-sm font-medium text-neutral-700 mb-1.5 block">
            Slug <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="tenantSlug"
            type="text"
            placeholder="acme-logistics"
            :class="[
              'w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              errors.tenant_slug ? 'border-danger-500' : 'border-neutral-300 focus:border-primary-500',
            ]"
          />
          <p v-if="errors.tenant_slug" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />{{ errors.tenant_slug }}
          </p>
        </div>
      </div>

      <!-- Name -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-5">
        <div>
          <label class="text-sm font-medium text-neutral-700 mb-1.5 block">
            First Name <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="firstName"
            type="text"
            placeholder="John"
            :class="[
              'w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              errors.first_name ? 'border-danger-500' : 'border-neutral-300 focus:border-primary-500',
            ]"
          />
          <p v-if="errors.first_name" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />{{ errors.first_name }}
          </p>
        </div>
        <div>
          <label class="text-sm font-medium text-neutral-700 mb-1.5 block">
            Last Name <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="lastName"
            type="text"
            placeholder="Smith"
            :class="[
              'w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              errors.last_name ? 'border-danger-500' : 'border-neutral-300 focus:border-primary-500',
            ]"
          />
          <p v-if="errors.last_name" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />{{ errors.last_name }}
          </p>
        </div>
      </div>

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
            errors.email ? 'border-danger-500' : 'border-neutral-300 focus:border-primary-500',
          ]"
        />
        <p v-if="errors.email" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
          <AlertCircle class="w-3.5 h-3.5" />{{ errors.email }}
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
            placeholder="Min 8 chars, mixed case, digit, special"
            autocomplete="new-password"
            :class="[
              'w-full h-10 bg-white border rounded-lg px-3 pr-10 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              errors.password ? 'border-danger-500' : 'border-neutral-300 focus:border-primary-500',
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
          <AlertCircle class="w-3.5 h-3.5" />{{ errors.password }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
        <span>{{ submitting ? 'Creating account...' : 'Create account' }}</span>
      </button>
    </form>

    <p class="text-sm text-neutral-400 text-center mt-6">
      Already have an account?
      <RouterLink to="/login" class="text-primary-500 hover:text-primary-600 font-medium">
        Sign in
      </RouterLink>
    </p>
  </div>
</template>
