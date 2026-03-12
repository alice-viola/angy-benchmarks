<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  ArrowLeft,
  Package,
  MapPin,
  Truck,
  User,
  Calendar,
  Weight,
  Thermometer,
  AlertTriangle,
  Clock,
} from 'lucide-vue-next';
import { useShipmentStore } from '../stores/shipments';
import StatusBadge from '../components/common/StatusBadge.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import TransitionButton from '../components/shipments/TransitionButton.vue';
import ShipmentTimeline from '../components/shipments/ShipmentTimeline.vue';
import type { ShipmentEventResponse } from '@nexusfleet/shared';

const route = useRoute();
const id = ref(route.params.id as string);
const shipmentStore = useShipmentStore();
const events = ref<ShipmentEventResponse[]>([]);
const error = ref('');

const shipment = computed(() => shipmentStore.currentShipment);
const loading = computed(() => shipmentStore.loading);

onMounted(async () => {
  try {
    await shipmentStore.fetch(id.value);
    events.value = await shipmentStore.fetchEvents(id.value);
  } catch {
    error.value = 'Failed to load shipment';
  }
});

async function handleTransitioned() {
  await shipmentStore.fetch(id.value);
  events.value = await shipmentStore.fetchEvents(id.value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div>
    <div class="mb-6">
      <RouterLink to="/shipments" class="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 transition-colors mb-3">
        <ArrowLeft class="w-4 h-4" />
        Back to Shipments
      </RouterLink>

      <!-- Loading header -->
      <div v-if="loading" class="flex items-center justify-between">
        <div>
          <LoadingSkeleton width="200px" height="28px" class="mb-2" />
          <LoadingSkeleton width="120px" height="16px" />
        </div>
      </div>

      <!-- Loaded header -->
      <div v-else-if="shipment" class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-neutral-800 tracking-tight">
              {{ shipment.reference_code || 'Draft Shipment' }}
            </h1>
            <StatusBadge :status="shipment.status" />
          </div>
          <p class="text-sm text-neutral-400 mt-1">{{ shipment.customer_name }}</p>
        </div>
        <div class="flex items-center gap-3">
          <TransitionButton
            :shipment-id="shipment.id"
            :status="shipment.status"
            @transitioned="handleTransitioned"
          />
          <RouterLink
            :to="`/shipments/${id}/edit`"
            class="bg-neutral-100 text-neutral-700 font-medium px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-all duration-150 text-sm"
          >
            Edit
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 flex items-center gap-3 mb-6">
      <AlertTriangle class="w-4 h-4 text-danger-500 flex-shrink-0" />
      <p class="text-sm text-danger-700">{{ error }}</p>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
          <LoadingSkeleton width="100%" height="120px" />
        </div>
      </div>
      <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
        <LoadingSkeleton width="100%" height="200px" />
      </div>
    </div>

    <!-- Content -->
    <div v-else-if="shipment" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <!-- Addresses -->
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
          <h2 class="text-base font-medium text-neutral-800 mb-4">Locations</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center flex-shrink-0">
                <MapPin class="w-5 h-5 text-accent-500" />
              </div>
              <div>
                <p class="text-xs font-medium text-neutral-400 uppercase">Origin</p>
                <p class="text-sm text-neutral-700 mt-0.5">{{ shipment.origin_address }}</p>
              </div>
            </div>
            <div class="flex gap-3">
              <div class="w-10 h-10 rounded-lg bg-success-50 flex items-center justify-center flex-shrink-0">
                <MapPin class="w-5 h-5 text-success-500" />
              </div>
              <div>
                <p class="text-xs font-medium text-neutral-400 uppercase">Destination</p>
                <p class="text-sm text-neutral-700 mt-0.5">{{ shipment.dest_address }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Cargo info -->
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
          <h2 class="text-base font-medium text-neutral-800 mb-4">Cargo Details</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <Package class="w-3.5 h-3.5 text-neutral-400" />
                <span class="text-xs font-medium text-neutral-400 uppercase">Type</span>
              </div>
              <p class="text-sm text-neutral-700 capitalize">{{ shipment.cargo_type }}</p>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <Weight class="w-3.5 h-3.5 text-neutral-400" />
                <span class="text-xs font-medium text-neutral-400 uppercase">Weight</span>
              </div>
              <p class="text-sm text-neutral-700">{{ shipment.cargo_weight_kg }} kg</p>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <Package class="w-3.5 h-3.5 text-neutral-400" />
                <span class="text-xs font-medium text-neutral-400 uppercase">Volume</span>
              </div>
              <p class="text-sm text-neutral-700">{{ shipment.cargo_volume_m3 }} m&sup3;</p>
            </div>
            <div v-if="shipment.requires_temp_control">
              <div class="flex items-center gap-1.5 mb-1">
                <Thermometer class="w-3.5 h-3.5 text-neutral-400" />
                <span class="text-xs font-medium text-neutral-400 uppercase">Temp</span>
              </div>
              <p class="text-sm text-neutral-700">{{ shipment.temp_min_c }}&deg;C – {{ shipment.temp_max_c }}&deg;C</p>
            </div>
          </div>
          <p class="text-sm text-neutral-600 mt-4">{{ shipment.cargo_description }}</p>
        </div>

        <!-- Assignment -->
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
          <h2 class="text-base font-medium text-neutral-800 mb-4">Assignment</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex gap-3">
              <div class="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Truck class="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p class="text-xs font-medium text-neutral-400 uppercase">Vehicle</p>
                <p v-if="shipment.assigned_vehicle" class="text-sm text-neutral-700 mt-0.5">
                  {{ shipment.assigned_vehicle.registration }} — {{ shipment.assigned_vehicle.make }} {{ shipment.assigned_vehicle.model }}
                </p>
                <p v-else class="text-sm text-neutral-400 mt-0.5">Not assigned</p>
              </div>
            </div>
            <div class="flex gap-3">
              <div class="w-10 h-10 rounded-lg bg-info-50 flex items-center justify-center flex-shrink-0">
                <User class="w-5 h-5 text-info-500" />
              </div>
              <div>
                <p class="text-xs font-medium text-neutral-400 uppercase">Driver</p>
                <p v-if="shipment.assigned_driver" class="text-sm text-neutral-700 mt-0.5">
                  {{ shipment.assigned_driver.first_name }} {{ shipment.assigned_driver.last_name }}
                </p>
                <p v-else class="text-sm text-neutral-400 mt-0.5">Not assigned</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Dates -->
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
          <h2 class="text-base font-medium text-neutral-800 mb-4">Dates</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <Calendar class="w-3.5 h-3.5 text-neutral-400" />
                <span class="text-xs font-medium text-neutral-400 uppercase">Created</span>
              </div>
              <p class="text-sm text-neutral-700">{{ formatDate(shipment.created_at) }}</p>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <Clock class="w-3.5 h-3.5 text-neutral-400" />
                <span class="text-xs font-medium text-neutral-400 uppercase">Scheduled Pickup</span>
              </div>
              <p class="text-sm text-neutral-700">{{ formatDate(shipment.scheduled_pickup_at) }}</p>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <Clock class="w-3.5 h-3.5 text-neutral-400" />
                <span class="text-xs font-medium text-neutral-400 uppercase">Actual Pickup</span>
              </div>
              <p class="text-sm text-neutral-700">{{ formatDate(shipment.actual_pickup_at) }}</p>
            </div>
          </div>
        </div>

        <!-- Failure / cancellation reason -->
        <div
          v-if="shipment.failure_reason || shipment.cancellation_reason"
          class="bg-danger-50 border border-danger-200 rounded-xl p-5"
        >
          <div class="flex items-start gap-3">
            <AlertTriangle class="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-danger-700">
                {{ shipment.failure_reason ? 'Failure Reason' : 'Cancellation Reason' }}
              </p>
              <p class="text-sm text-danger-600 mt-1">
                {{ shipment.failure_reason || shipment.cancellation_reason }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right sidebar: Timeline -->
      <div>
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm p-5">
          <h2 class="text-base font-medium text-neutral-800 mb-4">Timeline</h2>
          <ShipmentTimeline :events="events" />
        </div>
      </div>
    </div>
  </div>
</template>
