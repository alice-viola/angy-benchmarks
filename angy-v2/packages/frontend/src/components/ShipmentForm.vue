<script setup lang="ts">
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { shipmentRequestSchema } from '@nexusfleet/shared';
import {
  Package,
  MapPin,
  Thermometer,
  AlertCircle,
  Loader2,
  Save,
} from 'lucide-vue-next';
import type { ShipmentRequest, ShipmentResponse } from '@nexusfleet/shared';

const props = defineProps<{
  initialData?: Partial<ShipmentResponse> | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: ShipmentRequest];
  cancel: [];
}>();

const schema = toTypedSchema(shipmentRequestSchema);

const { handleSubmit, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    customer_name: props.initialData?.customer_name || '',
    origin_address: props.initialData?.origin_address || '',
    origin_lat: (props.initialData as Record<string, unknown>)?.origin_lat as number || 0,
    origin_lng: (props.initialData as Record<string, unknown>)?.origin_lng as number || 0,
    dest_address: props.initialData?.dest_address || '',
    dest_lat: (props.initialData as Record<string, unknown>)?.dest_lat as number || 0,
    dest_lng: (props.initialData as Record<string, unknown>)?.dest_lng as number || 0,
    cargo_description: props.initialData?.cargo_description || '',
    cargo_weight_kg: props.initialData?.cargo_weight_kg || undefined,
    cargo_volume_m3: props.initialData?.cargo_volume_m3 || undefined,
    cargo_type: (props.initialData?.cargo_type as 'general' | 'fragile' | 'hazardous' | 'perishable') || 'general',
    priority: (props.initialData?.priority as 'low' | 'normal' | 'high' | 'critical') || 'normal',
    requires_temp_control: props.initialData?.requires_temp_control || false,
    temp_min_c: props.initialData?.temp_min_c ?? undefined,
    temp_max_c: props.initialData?.temp_max_c ?? undefined,
    scheduled_pickup_at: props.initialData?.scheduled_pickup_at || undefined,
  },
});

const { value: customerName } = useField<string>('customer_name');
const { value: originAddress } = useField<string>('origin_address');
const { value: originLat } = useField<number>('origin_lat');
const { value: originLng } = useField<number>('origin_lng');
const { value: destAddress } = useField<string>('dest_address');
const { value: destLat } = useField<number>('dest_lat');
const { value: destLng } = useField<number>('dest_lng');
const { value: cargoDescription } = useField<string>('cargo_description');
const { value: cargoWeightKg } = useField<number | undefined>('cargo_weight_kg');
const { value: cargoVolumeM3 } = useField<number | undefined>('cargo_volume_m3');
const { value: cargoType } = useField<string>('cargo_type');
const { value: priority } = useField<string>('priority');
const { value: requiresTempControl } = useField<boolean>('requires_temp_control');
const { value: tempMinC } = useField<number | undefined>('temp_min_c');
const { value: tempMaxC } = useField<number | undefined>('temp_max_c');
const { value: scheduledPickupAt } = useField<string | undefined>('scheduled_pickup_at');

const cargoTypes = [
  { value: 'general', label: 'General' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'hazardous', label: 'Hazardous' },
  { value: 'perishable', label: 'Perishable' },
];

const priorities = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const onSubmit = handleSubmit((values) => {
  emit('submit', values as ShipmentRequest);
});

</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <!-- Customer Info -->
    <div>
      <h3 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
        <Package class="w-5 h-5 text-primary-500" />
        Shipment Details
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Customer Name <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="customerName"
            type="text"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.customer_name ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="Enter customer name"
          />
          <p v-if="errors.customer_name" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.customer_name }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Priority
          </label>
          <select
            v-model="priority"
            class="w-full h-10 bg-white border border-neutral-300 rounded-lg px-3 text-sm text-neutral-700 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
          >
            <option v-for="p in priorities" :key="p.value" :value="p.value">
              {{ p.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Scheduled Pickup
          </label>
          <input
            v-model="scheduledPickupAt"
            type="datetime-local"
            class="w-full h-10 bg-white border border-neutral-300 rounded-lg px-3 text-sm text-neutral-700 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
          />
        </div>
      </div>
    </div>

    <!-- Origin -->
    <div>
      <h3 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
        <MapPin class="w-5 h-5 text-info-500" />
        Origin
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Origin Address <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="originAddress"
            type="text"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.origin_address ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="e.g. 123 Main St, New York, NY"
          />
          <p v-if="errors.origin_address" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.origin_address }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Latitude <span class="text-danger-500">*</span>
          </label>
          <input
            v-model.number="originLat"
            type="number"
            step="any"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.origin_lat ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="-90 to 90"
          />
          <p v-if="errors.origin_lat" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.origin_lat }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Longitude <span class="text-danger-500">*</span>
          </label>
          <input
            v-model.number="originLng"
            type="number"
            step="any"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.origin_lng ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="-180 to 180"
          />
          <p v-if="errors.origin_lng" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.origin_lng }}
          </p>
        </div>
      </div>
    </div>

    <!-- Destination -->
    <div>
      <h3 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
        <MapPin class="w-5 h-5 text-success-500" />
        Destination
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Destination Address <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="destAddress"
            type="text"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.dest_address ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="e.g. 456 Oak Ave, Brooklyn, NY"
          />
          <p v-if="errors.dest_address" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.dest_address }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Latitude <span class="text-danger-500">*</span>
          </label>
          <input
            v-model.number="destLat"
            type="number"
            step="any"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.dest_lat ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="-90 to 90"
          />
          <p v-if="errors.dest_lat" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.dest_lat }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Longitude <span class="text-danger-500">*</span>
          </label>
          <input
            v-model.number="destLng"
            type="number"
            step="any"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.dest_lng ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="-180 to 180"
          />
          <p v-if="errors.dest_lng" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.dest_lng }}
          </p>
        </div>
      </div>
    </div>

    <!-- Cargo Info -->
    <div>
      <h3 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
        <Package class="w-5 h-5 text-accent-500" />
        Cargo Information
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Cargo Description <span class="text-danger-500">*</span>
          </label>
          <textarea
            v-model="cargoDescription"
            rows="2"
            class="w-full min-h-[80px] resize-y bg-white border rounded-lg px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.cargo_description ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="Describe the cargo..."
          />
          <p v-if="errors.cargo_description" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.cargo_description }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Cargo Type <span class="text-danger-500">*</span>
          </label>
          <select
            v-model="cargoType"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.cargo_type ? 'border-danger-500' : 'border-neutral-300'"
          >
            <option v-for="ct in cargoTypes" :key="ct.value" :value="ct.value">
              {{ ct.label }}
            </option>
          </select>
          <p v-if="errors.cargo_type" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.cargo_type }}
          </p>
        </div>

        <div>
          <!-- spacer on this row -->
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Weight (kg) <span class="text-danger-500">*</span>
          </label>
          <input
            v-model.number="cargoWeightKg"
            type="number"
            step="0.01"
            min="0"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.cargo_weight_kg ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="e.g. 500"
          />
          <p v-if="errors.cargo_weight_kg" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.cargo_weight_kg }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1.5">
            Volume (m³) <span class="text-danger-500">*</span>
          </label>
          <input
            v-model.number="cargoVolumeM3"
            type="number"
            step="0.01"
            min="0"
            class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            :class="errors.cargo_volume_m3 ? 'border-danger-500' : 'border-neutral-300'"
            placeholder="e.g. 2.5"
          />
          <p v-if="errors.cargo_volume_m3" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            {{ errors.cargo_volume_m3 }}
          </p>
        </div>
      </div>
    </div>

    <!-- Temperature Control -->
    <div>
      <h3 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
        <Thermometer class="w-5 h-5 text-info-500" />
        Temperature Control
      </h3>

      <div class="space-y-5">
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            v-model="requiresTempControl"
            type="checkbox"
            class="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500/20"
          />
          <span class="text-sm font-medium text-neutral-700">
            Requires temperature control
          </span>
        </label>

        <div
          v-if="requiresTempControl"
          class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pl-7"
        >
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">
              Min Temperature (°C) <span class="text-danger-500">*</span>
            </label>
            <input
              v-model.number="tempMinC"
              type="number"
              step="0.1"
              class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
              :class="errors.temp_min_c ? 'border-danger-500' : 'border-neutral-300'"
              placeholder="e.g. 2"
            />
            <p v-if="errors.temp_min_c" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
              <AlertCircle class="w-3.5 h-3.5" />
              {{ errors.temp_min_c }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">
              Max Temperature (°C) <span class="text-danger-500">*</span>
            </label>
            <input
              v-model.number="tempMaxC"
              type="number"
              step="0.1"
              class="w-full h-10 bg-white border rounded-lg px-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
              :class="errors.temp_max_c ? 'border-danger-500' : 'border-neutral-300'"
              placeholder="e.g. 8"
            />
            <p v-if="errors.temp_max_c" class="text-xs text-danger-500 mt-1 flex items-center gap-1">
              <AlertCircle class="w-3.5 h-3.5" />
              {{ errors.temp_max_c }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
      <button
        type="button"
        class="bg-white text-neutral-700 border border-neutral-300 font-medium px-4 py-2.5 rounded-lg hover:bg-neutral-50 transition-all duration-150"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="submit"
        :disabled="submitting"
        class="bg-primary-500 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-primary-600 hover:shadow-md active:bg-primary-700 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center"
      >
        <Loader2 v-if="submitting" class="w-[18px] h-[18px] animate-spin" />
        <Save v-else class="w-[18px] h-[18px]" />
        {{ submitting ? 'Saving...' : (initialData ? 'Update' : 'Create') }}
      </button>
    </div>
  </form>
</template>
