<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { createDriverSchema } from '@nexus-fleet/shared';
import type { CreateDriverInput } from '@nexus-fleet/shared';

const props = defineProps<{
  initialValues?: Partial<CreateDriverInput>;
  submitLabel?: string;
}>();

const emit = defineEmits<{
  submit: [values: CreateDriverInput];
}>();

const { handleSubmit, defineField, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(createDriverSchema),
  initialValues: props.initialValues ?? {},
});

const [first_name, first_nameAttrs] = defineField('first_name');
const [last_name, last_nameAttrs] = defineField('last_name');
const [email, emailAttrs] = defineField('email');
const [phone, phoneAttrs] = defineField('phone');
const [license_number, license_numberAttrs] = defineField('license_number');
const [license_class, license_classAttrs] = defineField('license_class');

const onSubmit = handleSubmit((values) => {
  emit('submit', values as CreateDriverInput);
});
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">First Name</label>
        <input v-model="first_name" v-bind="first_nameAttrs" type="text"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p v-if="errors.first_name" class="mt-1 text-sm text-red-600">{{ errors.first_name }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
        <input v-model="last_name" v-bind="last_nameAttrs" type="text"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p v-if="errors.last_name" class="mt-1 text-sm text-red-600">{{ errors.last_name }}</p>
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
      <input v-model="email" v-bind="emailAttrs" type="email"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p v-if="errors.email" class="mt-1 text-sm text-red-600">{{ errors.email }}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Phone</label>
      <input v-model="phone" v-bind="phoneAttrs" type="tel"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p v-if="errors.phone" class="mt-1 text-sm text-red-600">{{ errors.phone }}</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">License Number</label>
        <input v-model="license_number" v-bind="license_numberAttrs" type="text"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p v-if="errors.license_number" class="mt-1 text-sm text-red-600">{{ errors.license_number }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">License Class</label>
        <input v-model="license_class" v-bind="license_classAttrs" type="text" placeholder="B, C, CE"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p v-if="errors.license_class" class="mt-1 text-sm text-red-600">{{ errors.license_class }}</p>
      </div>
    </div>
    <button type="submit" :disabled="isSubmitting"
      class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
      {{ isSubmitting ? 'Saving...' : (submitLabel || 'Save Driver') }}
    </button>
  </form>
</template>
