<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { registerSchema } from '@nexus-fleet/shared';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const auth = useAuthStore();

const { handleSubmit, defineField, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(registerSchema),
});

const [tenantName, tenantNameAttrs] = defineField('tenant_name');
const [firstName, firstNameAttrs] = defineField('first_name');
const [lastName, lastNameAttrs] = defineField('last_name');
const [email, emailAttrs] = defineField('email');
const [password, passwordAttrs] = defineField('password');

const onSubmit = handleSubmit(async (values) => {
  try {
    await auth.register(
      values.tenant_name,
      values.email,
      values.password,
      values.first_name,
      values.last_name,
    );
    router.push('/dashboard');
  } catch {
    // Error toast handled by auth store
  }
});
</script>

<template>
  <div>
    <h2 class="text-2xl font-bold text-slate-900 text-center mb-6">Create your account</h2>
    <form @submit.prevent="onSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
        <input
          v-model="tenantName"
          v-bind="tenantNameAttrs"
          type="text"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Acme Corp"
        />
        <p v-if="errors.tenant_name" class="mt-1 text-sm text-red-600">{{ errors.tenant_name }}</p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">First Name</label>
          <input
            v-model="firstName"
            v-bind="firstNameAttrs"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p v-if="errors.first_name" class="mt-1 text-sm text-red-600">{{ errors.first_name }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
          <input
            v-model="lastName"
            v-bind="lastNameAttrs"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p v-if="errors.last_name" class="mt-1 text-sm text-red-600">{{ errors.last_name }}</p>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="you@example.com"
        />
        <p v-if="errors.email" class="mt-1 text-sm text-red-600">{{ errors.email }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
        <input
          v-model="password"
          v-bind="passwordAttrs"
          type="password"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Min 8 characters"
        />
        <p v-if="errors.password" class="mt-1 text-sm text-red-600">{{ errors.password }}</p>
      </div>
      <button
        type="submit"
        :disabled="isSubmitting"
        class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {{ isSubmitting ? 'Creating account...' : 'Create account' }}
      </button>
      <p class="text-center text-sm text-slate-500">
        Already have an account?
        <router-link to="/login" class="text-blue-600 hover:underline">Sign in</router-link>
      </p>
    </form>
  </div>
</template>
