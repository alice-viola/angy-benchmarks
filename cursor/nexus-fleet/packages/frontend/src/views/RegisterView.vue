<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm, useField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const error = ref('')

const registerSchema = z
  .object({
    companyName: z.string().min(2, 'Company name must be at least 2 characters').max(200),
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must include at least one uppercase letter')
      .regex(/[0-9]/, 'Must include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const { handleSubmit } = useForm({
  validationSchema: toTypedSchema(registerSchema),
})

const companyName = useField<string>('companyName')
const firstName = useField<string>('firstName')
const lastName = useField<string>('lastName')
const email = useField<string>('email')
const password = useField<string>('password')
const confirmPassword = useField<string>('confirmPassword')

const onSubmit = handleSubmit(async (values) => {
  error.value = ''
  try {
    await authStore.register({
      companyName: values.companyName,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
    })
    router.push('/dashboard')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Registration failed. Please try again.'
  }
})
</script>

<template>
  <AuthLayout>
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-xl font-semibold text-white">Create your account</h2>
        <p class="mt-1 text-sm text-slate-400">Start managing your fleet in minutes</p>
      </div>

      <!-- Error alert -->
      <Transition
        enter-active-class="duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="error"
          class="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3"
        >
          <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p class="flex-1 text-sm text-red-400/90">{{ error }}</p>
          <button class="text-red-400 hover:text-red-300" @click="error = ''">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Transition>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <!-- Company name -->
        <div>
          <label for="reg-company" class="mb-1.5 block text-sm font-medium text-slate-300">Company name</label>
          <input
            id="reg-company"
            v-model="companyName.value.value"
            type="text"
            autocomplete="organization"
            placeholder="Acme Logistics"
            class="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:bg-white/[0.07] focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
            :class="{ 'border-red-500/50': companyName.errorMessage.value }"
          />
          <p v-if="companyName.errorMessage.value" class="mt-1 text-xs text-red-400">{{ companyName.errorMessage.value }}</p>
        </div>

        <!-- Name row -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="reg-first" class="mb-1.5 block text-sm font-medium text-slate-300">First name</label>
            <input
              id="reg-first"
              v-model="firstName.value.value"
              type="text"
              autocomplete="given-name"
              placeholder="Jane"
              class="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:bg-white/[0.07] focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
              :class="{ 'border-red-500/50': firstName.errorMessage.value }"
            />
            <p v-if="firstName.errorMessage.value" class="mt-1 text-xs text-red-400">{{ firstName.errorMessage.value }}</p>
          </div>
          <div>
            <label for="reg-last" class="mb-1.5 block text-sm font-medium text-slate-300">Last name</label>
            <input
              id="reg-last"
              v-model="lastName.value.value"
              type="text"
              autocomplete="family-name"
              placeholder="Doe"
              class="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:bg-white/[0.07] focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
              :class="{ 'border-red-500/50': lastName.errorMessage.value }"
            />
            <p v-if="lastName.errorMessage.value" class="mt-1 text-xs text-red-400">{{ lastName.errorMessage.value }}</p>
          </div>
        </div>

        <!-- Email -->
        <div>
          <label for="reg-email" class="mb-1.5 block text-sm font-medium text-slate-300">Email address</label>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg class="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <input
              id="reg-email"
              v-model="email.value.value"
              type="email"
              autocomplete="email"
              placeholder="you@company.com"
              class="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:bg-white/[0.07] focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
              :class="{ 'border-red-500/50': email.errorMessage.value }"
            />
          </div>
          <p v-if="email.errorMessage.value" class="mt-1 text-xs text-red-400">{{ email.errorMessage.value }}</p>
        </div>

        <!-- Password -->
        <div>
          <label for="reg-password" class="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg class="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <input
              id="reg-password"
              v-model="password.value.value"
              type="password"
              autocomplete="new-password"
              placeholder="Min 8 characters"
              class="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:bg-white/[0.07] focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
              :class="{ 'border-red-500/50': password.errorMessage.value }"
            />
          </div>
          <p v-if="password.errorMessage.value" class="mt-1 text-xs text-red-400">{{ password.errorMessage.value }}</p>
        </div>

        <!-- Confirm Password -->
        <div>
          <label for="reg-confirm" class="mb-1.5 block text-sm font-medium text-slate-300">Confirm password</label>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg class="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <input
              id="reg-confirm"
              v-model="confirmPassword.value.value"
              type="password"
              autocomplete="new-password"
              placeholder="Re-enter your password"
              class="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:bg-white/[0.07] focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
              :class="{ 'border-red-500/50': confirmPassword.errorMessage.value }"
            />
          </div>
          <p v-if="confirmPassword.errorMessage.value" class="mt-1 text-xs text-red-400">{{ confirmPassword.errorMessage.value }}</p>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="authStore.loading"
          class="relative mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <svg
            v-if="authStore.loading"
            class="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ authStore.loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>

      <!-- Login link -->
      <p class="text-center text-sm text-slate-400">
        Already have an account?
        <RouterLink to="/login" class="font-medium text-primary-400 hover:text-primary-300 transition-colors">
          Sign in
        </RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>
