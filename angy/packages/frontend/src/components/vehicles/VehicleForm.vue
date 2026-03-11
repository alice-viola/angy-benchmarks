<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { createVehicleSchema, VEHICLE_TYPES } from '@nexus-fleet/shared';
import type { CreateVehicleInput } from '@nexus-fleet/shared';

const props = defineProps<{
  initialValues?: Partial<CreateVehicleInput>;
  submitLabel?: string;
}>();

const emit = defineEmits<{
  submit: [values: CreateVehicleInput];
}>();

const { handleSubmit, defineField, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(createVehicleSchema),
  initialValues: props.initialValues ?? {},
});

const [plate_number, plate_numberAttrs] = defineField('plate_number');
const [vehicle_type, vehicle_typeAttrs] = defineField('vehicle_type');
const [make, makeAttrs] = defineField('make');
const [model, modelAttrs] = defineField('model');
const [year, yearAttrs] = defineField('year');
const [max_weight_kg, max_weight_kgAttrs] = defineField('max_weight_kg');
const [max_volume_m3, max_volume_m3Attrs] = defineField('max_volume_m3');

const onSubmit = handleSubmit((values) => {
  emit('submit', values as CreateVehicleInput);
});
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Plate Number</label>
      <input v-model="plate_number" v-bind="plate_numberAttrs" type="text"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p v-if="errors.plate_number" class="mt-1 text-sm text-red-600">{{ errors.plate_number }}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Vehicle Type</label>
      <select v-model="vehicle_type" v-bind="vehicle_typeAttrs"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">Select type...</option>
        <option v-for="t in VEHICLE_TYPES" :key="t" :value="t">{{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
      </select>
      <p v-if="errors.vehicle_type" class="mt-1 text-sm text-red-600">{{ errors.vehicle_type }}</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Make</label>
        <input v-model="make" v-bind="makeAttrs" type="text"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p v-if="errors.make" class="mt-1 text-sm text-red-600">{{ errors.make }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Model</label>
        <input v-model="model" v-bind="modelAttrs" type="text"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p v-if="errors.model" class="mt-1 text-sm text-red-600">{{ errors.model }}</p>
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Year</label>
      <input v-model.number="year" v-bind="yearAttrs" type="number"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p v-if="errors.year" class="mt-1 text-sm text-red-600">{{ errors.year }}</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Max Weight (kg)</label>
        <input v-model.number="max_weight_kg" v-bind="max_weight_kgAttrs" type="number" step="0.01"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p v-if="errors.max_weight_kg" class="mt-1 text-sm text-red-600">{{ errors.max_weight_kg }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Max Volume (m³)</label>
        <input v-model.number="max_volume_m3" v-bind="max_volume_m3Attrs" type="number" step="0.01"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p v-if="errors.max_volume_m3" class="mt-1 text-sm text-red-600">{{ errors.max_volume_m3 }}</p>
      </div>
    </div>
    <button type="submit" :disabled="isSubmitting"
      class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
      {{ isSubmitting ? 'Saving...' : (submitLabel || 'Save Vehicle') }}
    </button>
  </form>
</template>
