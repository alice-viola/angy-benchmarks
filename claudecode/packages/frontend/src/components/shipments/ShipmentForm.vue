<script setup lang="ts">
import { watch } from 'vue';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { shipmentCreateSchema, CARGO_TYPES, PRIORITIES } from '@nexus-fleet/shared';
import type { Shipment } from '@/types';

const props = defineProps<{
  shipment?: Shipment | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: any];
  cancel: [];
}>();

const schema = toTypedSchema(shipmentCreateSchema);

const { handleSubmit, errors, resetForm } = useForm({
  validationSchema: schema,
  initialValues: props.shipment
    ? {
        customer_name: props.shipment.customer_name,
        origin_address: props.shipment.origin_address,
        origin_lat: props.shipment.origin_lat,
        origin_lng: props.shipment.origin_lng,
        dest_address: props.shipment.dest_address,
        dest_lat: props.shipment.dest_lat,
        dest_lng: props.shipment.dest_lng,
        cargo_description: props.shipment.cargo_description,
        cargo_weight_kg: props.shipment.cargo_weight_kg,
        cargo_volume_m3: props.shipment.cargo_volume_m3,
        cargo_type: props.shipment.cargo_type,
        requires_temp_control: props.shipment.requires_temp_control,
        temp_min_c: props.shipment.temp_min_c,
        temp_max_c: props.shipment.temp_max_c,
        priority: props.shipment.priority,
        scheduled_pickup_at: props.shipment.scheduled_pickup_at,
      }
    : {
        customer_name: '',
        origin_address: '',
        origin_lat: 0,
        origin_lng: 0,
        dest_address: '',
        dest_lat: 0,
        dest_lng: 0,
        cargo_description: '',
        cargo_weight_kg: 0,
        cargo_volume_m3: 0,
        cargo_type: 'general' as const,
        requires_temp_control: false,
        priority: 'normal' as const,
      },
});

const { value: customer_name } = useField<string>('customer_name');
const { value: origin_address } = useField<string>('origin_address');
const { value: origin_lat } = useField<number>('origin_lat');
const { value: origin_lng } = useField<number>('origin_lng');
const { value: dest_address } = useField<string>('dest_address');
const { value: dest_lat } = useField<number>('dest_lat');
const { value: dest_lng } = useField<number>('dest_lng');
const { value: cargo_description } = useField<string>('cargo_description');
const { value: cargo_weight_kg } = useField<number>('cargo_weight_kg');
const { value: cargo_volume_m3 } = useField<number>('cargo_volume_m3');
const { value: cargo_type } = useField<string>('cargo_type');
const { value: requires_temp_control } = useField<boolean>('requires_temp_control');
const { value: temp_min_c } = useField<number | undefined>('temp_min_c');
const { value: temp_max_c } = useField<number | undefined>('temp_max_c');
const { value: priority } = useField<string>('priority');
const { value: scheduled_pickup_at } = useField<string | undefined>('scheduled_pickup_at');

const onSubmit = handleSubmit((values) => {
  emit('submit', values);
});

watch(
  () => props.shipment,
  (shipment) => {
    if (shipment) {
      resetForm({ values: shipment as any });
    }
  },
);
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <!-- Customer -->
    <div class="card">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
      <div>
        <label class="label">Customer Name</label>
        <input v-model="customer_name" type="text" class="input" :class="{ 'input-error': errors.customer_name }" placeholder="Customer name" />
        <p v-if="errors.customer_name" class="mt-1 text-xs text-danger-500">{{ errors.customer_name }}</p>
      </div>
    </div>

    <!-- Origin -->
    <div class="card">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Origin</h3>
      <div class="space-y-4">
        <div>
          <label class="label">Address</label>
          <input v-model="origin_address" type="text" class="input" :class="{ 'input-error': errors.origin_address }" placeholder="Origin address" />
          <p v-if="errors.origin_address" class="mt-1 text-xs text-danger-500">{{ errors.origin_address }}</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Latitude</label>
            <input v-model.number="origin_lat" type="number" step="any" class="input" :class="{ 'input-error': errors.origin_lat }" />
            <p v-if="errors.origin_lat" class="mt-1 text-xs text-danger-500">{{ errors.origin_lat }}</p>
          </div>
          <div>
            <label class="label">Longitude</label>
            <input v-model.number="origin_lng" type="number" step="any" class="input" :class="{ 'input-error': errors.origin_lng }" />
            <p v-if="errors.origin_lng" class="mt-1 text-xs text-danger-500">{{ errors.origin_lng }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Destination -->
    <div class="card">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Destination</h3>
      <div class="space-y-4">
        <div>
          <label class="label">Address</label>
          <input v-model="dest_address" type="text" class="input" :class="{ 'input-error': errors.dest_address }" placeholder="Destination address" />
          <p v-if="errors.dest_address" class="mt-1 text-xs text-danger-500">{{ errors.dest_address }}</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Latitude</label>
            <input v-model.number="dest_lat" type="number" step="any" class="input" :class="{ 'input-error': errors.dest_lat }" />
            <p v-if="errors.dest_lat" class="mt-1 text-xs text-danger-500">{{ errors.dest_lat }}</p>
          </div>
          <div>
            <label class="label">Longitude</label>
            <input v-model.number="dest_lng" type="number" step="any" class="input" :class="{ 'input-error': errors.dest_lng }" />
            <p v-if="errors.dest_lng" class="mt-1 text-xs text-danger-500">{{ errors.dest_lng }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Cargo -->
    <div class="card">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Cargo Details</h3>
      <div class="space-y-4">
        <div>
          <label class="label">Description</label>
          <textarea v-model="cargo_description" class="input" :class="{ 'input-error': errors.cargo_description }" rows="3" placeholder="Describe the cargo" />
          <p v-if="errors.cargo_description" class="mt-1 text-xs text-danger-500">{{ errors.cargo_description }}</p>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="label">Weight (kg)</label>
            <input v-model.number="cargo_weight_kg" type="number" step="0.1" class="input" :class="{ 'input-error': errors.cargo_weight_kg }" />
            <p v-if="errors.cargo_weight_kg" class="mt-1 text-xs text-danger-500">{{ errors.cargo_weight_kg }}</p>
          </div>
          <div>
            <label class="label">Volume (m3)</label>
            <input v-model.number="cargo_volume_m3" type="number" step="0.01" class="input" :class="{ 'input-error': errors.cargo_volume_m3 }" />
            <p v-if="errors.cargo_volume_m3" class="mt-1 text-xs text-danger-500">{{ errors.cargo_volume_m3 }}</p>
          </div>
          <div>
            <label class="label">Cargo Type</label>
            <select v-model="cargo_type" class="input" :class="{ 'input-error': errors.cargo_type }">
              <option v-for="t in CARGO_TYPES" :key="t" :value="t">
                {{ t.charAt(0).toUpperCase() + t.slice(1) }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">Priority</label>
            <select v-model="priority" class="input" :class="{ 'input-error': errors.priority }">
              <option v-for="p in PRIORITIES" :key="p" :value="p">
                {{ p.charAt(0).toUpperCase() + p.slice(1) }}
              </option>
            </select>
          </div>
        </div>

        <!-- Temperature control -->
        <div>
          <label class="flex items-center gap-2">
            <input v-model="requires_temp_control" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span class="text-sm font-medium text-gray-700">Requires temperature control</span>
          </label>
        </div>

        <div v-if="requires_temp_control" class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Min Temperature (C)</label>
            <input v-model.number="temp_min_c" type="number" step="0.1" class="input" :class="{ 'input-error': errors.temp_min_c }" />
            <p v-if="errors.temp_min_c" class="mt-1 text-xs text-danger-500">{{ errors.temp_min_c }}</p>
          </div>
          <div>
            <label class="label">Max Temperature (C)</label>
            <input v-model.number="temp_max_c" type="number" step="0.1" class="input" :class="{ 'input-error': errors.temp_max_c }" />
            <p v-if="errors.temp_max_c" class="mt-1 text-xs text-danger-500">{{ errors.temp_max_c }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Schedule -->
    <div class="card">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Schedule</h3>
      <div>
        <label class="label">Scheduled Pickup</label>
        <input v-model="scheduled_pickup_at" type="datetime-local" class="input" />
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button type="submit" class="btn-primary" :disabled="loading">
        {{ shipment ? 'Update Shipment' : 'Create Shipment' }}
      </button>
      <button type="button" class="btn-secondary" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
