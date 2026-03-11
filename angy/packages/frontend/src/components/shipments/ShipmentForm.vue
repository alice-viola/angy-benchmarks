<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { createShipmentSchema } from '@nexus-fleet/shared';
import type { CreateShipmentInput } from '@nexus-fleet/shared';

const props = defineProps<{
  initialValues?: Partial<CreateShipmentInput>;
  submitLabel?: string;
}>();

const emit = defineEmits<{
  submit: [values: CreateShipmentInput];
}>();

const { handleSubmit, defineField, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(createShipmentSchema),
  initialValues: props.initialValues ?? {},
});

const [reference_code, reference_codeAttrs] = defineField('reference_code');
const [customer_name, customer_nameAttrs] = defineField('customer_name');
const [origin_address, origin_addressAttrs] = defineField('origin_address');
const [origin_lat, origin_latAttrs] = defineField('origin_lat');
const [origin_lng, origin_lngAttrs] = defineField('origin_lng');
const [dest_address, dest_addressAttrs] = defineField('dest_address');
const [dest_lat, dest_latAttrs] = defineField('dest_lat');
const [dest_lng, dest_lngAttrs] = defineField('dest_lng');
const [scheduled_pickup_at, scheduled_pickup_atAttrs] = defineField('scheduled_pickup_at');
const [scheduled_delivery_at, scheduled_delivery_atAttrs] = defineField('scheduled_delivery_at');
const [cargo_description, cargo_descriptionAttrs] = defineField('cargo_description');
const [cargo_weight_kg, cargo_weight_kgAttrs] = defineField('cargo_weight_kg');
const [cargo_volume_m3, cargo_volume_m3Attrs] = defineField('cargo_volume_m3');
const [notes, notesAttrs] = defineField('notes');

const onSubmit = handleSubmit((values) => {
  emit('submit', values as CreateShipmentInput);
});
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <!-- Reference -->
    <div>
      <label for="reference_code" class="block text-sm font-medium text-slate-700 mb-1">Reference Code</label>
      <input id="reference_code" v-model="reference_code" v-bind="reference_codeAttrs" type="text"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Optional reference" />
      <p v-if="errors.reference_code" class="mt-1 text-sm text-red-600">{{ errors.reference_code }}</p>
    </div>

    <!-- Customer -->
    <div>
      <label for="customer_name" class="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
      <input id="customer_name" v-model="customer_name" v-bind="customer_nameAttrs" type="text"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p v-if="errors.customer_name" class="mt-1 text-sm text-red-600">{{ errors.customer_name }}</p>
    </div>

    <!-- Origin Section -->
    <fieldset class="border border-slate-200 rounded-lg p-4">
      <legend class="text-sm font-semibold text-slate-700 px-2">Origin</legend>
      <div class="space-y-3">
        <div>
          <label for="origin_address" class="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <input id="origin_address" v-model="origin_address" v-bind="origin_addressAttrs" type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p v-if="errors.origin_address" class="mt-1 text-sm text-red-600">{{ errors.origin_address }}</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="origin_lat" class="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
            <input id="origin_lat" v-model.number="origin_lat" v-bind="origin_latAttrs" type="number" step="any"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p v-if="errors.origin_lat" class="mt-1 text-sm text-red-600">{{ errors.origin_lat }}</p>
          </div>
          <div>
            <label for="origin_lng" class="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
            <input id="origin_lng" v-model.number="origin_lng" v-bind="origin_lngAttrs" type="number" step="any"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p v-if="errors.origin_lng" class="mt-1 text-sm text-red-600">{{ errors.origin_lng }}</p>
          </div>
        </div>
        <div>
          <label for="scheduled_pickup_at" class="block text-sm font-medium text-slate-700 mb-1">Scheduled Pickup</label>
          <input id="scheduled_pickup_at" v-model="scheduled_pickup_at" v-bind="scheduled_pickup_atAttrs" type="datetime-local"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p v-if="errors.scheduled_pickup_at" class="mt-1 text-sm text-red-600">{{ errors.scheduled_pickup_at }}</p>
        </div>
      </div>
    </fieldset>

    <!-- Destination Section -->
    <fieldset class="border border-slate-200 rounded-lg p-4">
      <legend class="text-sm font-semibold text-slate-700 px-2">Destination</legend>
      <div class="space-y-3">
        <div>
          <label for="dest_address" class="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <input id="dest_address" v-model="dest_address" v-bind="dest_addressAttrs" type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p v-if="errors.dest_address" class="mt-1 text-sm text-red-600">{{ errors.dest_address }}</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="dest_lat" class="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
            <input id="dest_lat" v-model.number="dest_lat" v-bind="dest_latAttrs" type="number" step="any"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p v-if="errors.dest_lat" class="mt-1 text-sm text-red-600">{{ errors.dest_lat }}</p>
          </div>
          <div>
            <label for="dest_lng" class="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
            <input id="dest_lng" v-model.number="dest_lng" v-bind="dest_lngAttrs" type="number" step="any"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p v-if="errors.dest_lng" class="mt-1 text-sm text-red-600">{{ errors.dest_lng }}</p>
          </div>
        </div>
        <div>
          <label for="scheduled_delivery_at" class="block text-sm font-medium text-slate-700 mb-1">Scheduled Delivery</label>
          <input id="scheduled_delivery_at" v-model="scheduled_delivery_at" v-bind="scheduled_delivery_atAttrs" type="datetime-local"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p v-if="errors.scheduled_delivery_at" class="mt-1 text-sm text-red-600">{{ errors.scheduled_delivery_at }}</p>
        </div>
      </div>
    </fieldset>

    <!-- Cargo Details -->
    <fieldset class="border border-slate-200 rounded-lg p-4">
      <legend class="text-sm font-semibold text-slate-700 px-2">Cargo Details</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="cargo_weight_kg" class="block text-sm font-medium text-slate-700 mb-1">Weight (kg)</label>
          <input id="cargo_weight_kg" v-model.number="cargo_weight_kg" v-bind="cargo_weight_kgAttrs" type="number" step="0.01"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p v-if="errors.cargo_weight_kg" class="mt-1 text-sm text-red-600">{{ errors.cargo_weight_kg }}</p>
        </div>
        <div>
          <label for="cargo_volume_m3" class="block text-sm font-medium text-slate-700 mb-1">Volume (m³)</label>
          <input id="cargo_volume_m3" v-model.number="cargo_volume_m3" v-bind="cargo_volume_m3Attrs" type="number" step="0.01"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p v-if="errors.cargo_volume_m3" class="mt-1 text-sm text-red-600">{{ errors.cargo_volume_m3 }}</p>
        </div>
      </div>
    </fieldset>

    <!-- Cargo Description -->
    <div>
      <label for="cargo_description" class="block text-sm font-medium text-slate-700 mb-1">Cargo Description</label>
      <textarea id="cargo_description" v-model="cargo_description" v-bind="cargo_descriptionAttrs" rows="2"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p v-if="errors.cargo_description" class="mt-1 text-sm text-red-600">{{ errors.cargo_description }}</p>
    </div>

    <!-- Notes -->
    <div>
      <label for="notes" class="block text-sm font-medium text-slate-700 mb-1">Notes</label>
      <textarea id="notes" v-model="notes" v-bind="notesAttrs" rows="3"
        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p v-if="errors.notes" class="mt-1 text-sm text-red-600">{{ errors.notes }}</p>
    </div>

    <button type="submit" :disabled="isSubmitting"
      class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
      {{ isSubmitting ? 'Saving...' : (submitLabel || 'Create Shipment') }}
    </button>
  </form>
</template>
