<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useForm, useField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { SHIPMENT_PRIORITIES, CARGO_TYPES } from '@nexus-fleet/shared'
import type { Shipment } from '@nexus-fleet/shared'

const props = withDefaults(
  defineProps<{
    shipment?: Shipment | null
    mode: 'create' | 'edit'
  }>(),
  { shipment: null },
)

const emit = defineEmits<{
  submit: [data: Record<string, unknown>]
  cancel: []
}>()

const formSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(200),
  priority: z.enum(SHIPMENT_PRIORITIES).default('normal'),
  cargoDescription: z.string().max(1000).optional().or(z.literal('')),
  cargoWeightKg: z.number({ invalid_type_error: 'Must be a number' }).positive('Weight must be positive'),
  cargoVolumeM3: z.number({ invalid_type_error: 'Must be a number' }).positive('Volume must be positive').optional().or(z.nan().transform(() => undefined)),
  cargoType: z.enum(CARGO_TYPES).default('general'),
  requiresTempControl: z.boolean().default(false),
  tempMinC: z.number({ invalid_type_error: 'Must be a number' }).optional(),
  tempMaxC: z.number({ invalid_type_error: 'Must be a number' }).optional(),
  originAddress: z.string().min(1, 'Origin address is required').max(500),
  originLat: z.number({ invalid_type_error: 'Must be a number' }).min(-90).max(90),
  originLng: z.number({ invalid_type_error: 'Must be a number' }).min(-180).max(180),
  destAddress: z.string().min(1, 'Destination address is required').max(500),
  destLat: z.number({ invalid_type_error: 'Must be a number' }).min(-90).max(90),
  destLng: z.number({ invalid_type_error: 'Must be a number' }).min(-180).max(180),
  scheduledPickupAt: z.string().min(1, 'Pickup date is required'),
})

const { handleSubmit, resetForm, setValues } = useForm({
  validationSchema: toTypedSchema(formSchema),
  initialValues: {
    customerName: '',
    priority: 'normal' as const,
    cargoDescription: '',
    cargoWeightKg: undefined as unknown as number,
    cargoVolumeM3: undefined as unknown as number,
    cargoType: 'general' as const,
    requiresTempControl: false,
    tempMinC: undefined as unknown as number,
    tempMaxC: undefined as unknown as number,
    originAddress: '',
    originLat: undefined as unknown as number,
    originLng: undefined as unknown as number,
    destAddress: '',
    destLat: undefined as unknown as number,
    destLng: undefined as unknown as number,
    scheduledPickupAt: '',
  },
})

const customerName = useField<string>('customerName')
const priority = useField<string>('priority')
const cargoDescription = useField<string>('cargoDescription')
const cargoWeightKg = useField<number>('cargoWeightKg')
const cargoVolumeM3 = useField<number>('cargoVolumeM3')
const cargoType = useField<string>('cargoType')
const requiresTempControl = useField<boolean>('requiresTempControl')
const tempMinC = useField<number>('tempMinC')
const tempMaxC = useField<number>('tempMaxC')
const originAddress = useField<string>('originAddress')
const originLat = useField<number>('originLat')
const originLng = useField<number>('originLng')
const destAddress = useField<string>('destAddress')
const destLat = useField<number>('destLat')
const destLng = useField<number>('destLng')
const scheduledPickupAt = useField<string>('scheduledPickupAt')

const submitting = ref(false)

watch(
  () => props.shipment,
  (s) => {
    if (s && props.mode === 'edit') {
      setValues({
        customerName: s.customerName,
        priority: s.priority,
        cargoDescription: s.cargoDescription ?? '',
        cargoWeightKg: s.weightKg,
        cargoVolumeM3: s.volumeM3,
        cargoType: s.cargoType,
        requiresTempControl: false,
        originAddress: s.pickupAddress.street,
        originLat: s.pickupAddress.lat ?? 0,
        originLng: s.pickupAddress.lng ?? 0,
        destAddress: s.deliveryAddress.street,
        destLat: s.deliveryAddress.lat ?? 0,
        destLng: s.deliveryAddress.lng ?? 0,
        scheduledPickupAt: s.scheduledPickup ? s.scheduledPickup.slice(0, 16) : '',
      })
    }
  },
  { immediate: true },
)

const showTempFields = computed(() => requiresTempControl.value.value)

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  try {
    emit('submit', { ...values })
  } finally {
    submitting.value = false
  }
})

const priorityOptions = SHIPMENT_PRIORITIES.map((p) => ({
  value: p,
  label: p.charAt(0).toUpperCase() + p.slice(1),
}))

const cargoOptions = CARGO_TYPES.map((c) => ({
  value: c,
  label: c.charAt(0).toUpperCase() + c.slice(1),
}))
</script>

<template>
  <form class="space-y-6" @submit.prevent="onSubmit">
    <!-- Customer & Priority -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Customer Name *</label>
        <input
          v-model="customerName.value.value"
          type="text"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          :class="{ 'border-red-400': customerName.errorMessage.value }"
          placeholder="Customer name"
        />
        <p v-if="customerName.errorMessage.value" class="mt-1 text-xs text-red-500">
          {{ customerName.errorMessage.value }}
        </p>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Priority</label>
        <select
          v-model="priority.value.value"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Cargo Info -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-3">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Cargo Type</label>
        <select
          v-model="cargoType.value.value"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option v-for="opt in cargoOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Weight (kg) *</label>
        <input
          v-model.number="cargoWeightKg.value.value"
          type="number"
          step="0.01"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          :class="{ 'border-red-400': cargoWeightKg.errorMessage.value }"
          placeholder="0.00"
        />
        <p v-if="cargoWeightKg.errorMessage.value" class="mt-1 text-xs text-red-500">
          {{ cargoWeightKg.errorMessage.value }}
        </p>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Volume (m³)</label>
        <input
          v-model.number="cargoVolumeM3.value.value"
          type="number"
          step="0.01"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="0.00"
        />
      </div>
    </div>

    <!-- Description -->
    <div>
      <label class="mb-1 block text-sm font-medium text-gray-700">Cargo Description</label>
      <textarea
        v-model="cargoDescription.value.value"
        rows="2"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        placeholder="Describe the cargo..."
      />
    </div>

    <!-- Temperature Control -->
    <div class="space-y-3">
      <label class="flex items-center gap-2">
        <input
          v-model="requiresTempControl.value.value"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span class="text-sm font-medium text-gray-700">Requires Temperature Control</span>
      </label>

      <div v-if="showTempFields" class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">Min Temp (°C)</label>
          <input
            v-model.number="tempMinC.value.value"
            type="number"
            step="0.1"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="-20"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">Max Temp (°C)</label>
          <input
            v-model.number="tempMaxC.value.value"
            type="number"
            step="0.1"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="5"
          />
        </div>
      </div>
    </div>

    <!-- Origin -->
    <fieldset class="rounded-lg border border-gray-200 p-4">
      <legend class="px-2 text-sm font-semibold text-gray-700">Origin</legend>
      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">Address *</label>
          <input
            v-model="originAddress.value.value"
            type="text"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            :class="{ 'border-red-400': originAddress.errorMessage.value }"
            placeholder="Street address"
          />
          <p v-if="originAddress.errorMessage.value" class="mt-1 text-xs text-red-500">
            {{ originAddress.errorMessage.value }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Latitude *</label>
            <input
              v-model.number="originLat.value.value"
              type="number"
              step="any"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              :class="{ 'border-red-400': originLat.errorMessage.value }"
              placeholder="40.7128"
            />
            <p v-if="originLat.errorMessage.value" class="mt-1 text-xs text-red-500">
              {{ originLat.errorMessage.value }}
            </p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Longitude *</label>
            <input
              v-model.number="originLng.value.value"
              type="number"
              step="any"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              :class="{ 'border-red-400': originLng.errorMessage.value }"
              placeholder="-74.0060"
            />
            <p v-if="originLng.errorMessage.value" class="mt-1 text-xs text-red-500">
              {{ originLng.errorMessage.value }}
            </p>
          </div>
        </div>
      </div>
    </fieldset>

    <!-- Destination -->
    <fieldset class="rounded-lg border border-gray-200 p-4">
      <legend class="px-2 text-sm font-semibold text-gray-700">Destination</legend>
      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">Address *</label>
          <input
            v-model="destAddress.value.value"
            type="text"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            :class="{ 'border-red-400': destAddress.errorMessage.value }"
            placeholder="Street address"
          />
          <p v-if="destAddress.errorMessage.value" class="mt-1 text-xs text-red-500">
            {{ destAddress.errorMessage.value }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Latitude *</label>
            <input
              v-model.number="destLat.value.value"
              type="number"
              step="any"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              :class="{ 'border-red-400': destLat.errorMessage.value }"
              placeholder="34.0522"
            />
            <p v-if="destLat.errorMessage.value" class="mt-1 text-xs text-red-500">
              {{ destLat.errorMessage.value }}
            </p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Longitude *</label>
            <input
              v-model.number="destLng.value.value"
              type="number"
              step="any"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              :class="{ 'border-red-400': destLng.errorMessage.value }"
              placeholder="-118.2437"
            />
            <p v-if="destLng.errorMessage.value" class="mt-1 text-xs text-red-500">
              {{ destLng.errorMessage.value }}
            </p>
          </div>
        </div>
      </div>
    </fieldset>

    <!-- Schedule -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Scheduled Pickup *</label>
        <input
          v-model="scheduledPickupAt.value.value"
          type="datetime-local"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          :class="{ 'border-red-400': scheduledPickupAt.errorMessage.value }"
        />
        <p v-if="scheduledPickupAt.errorMessage.value" class="mt-1 text-xs text-red-500">
          {{ scheduledPickupAt.errorMessage.value }}
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 border-t border-gray-200 pt-5">
      <button
        type="button"
        class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        :disabled="submitting"
      >
        <svg
          v-if="submitting"
          class="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ mode === 'create' ? 'Create Shipment' : 'Update Shipment' }}
      </button>
    </div>
  </form>
</template>
