<script setup lang="ts">
import type { ShipmentEvent } from '@/stores/shipment.store';

defineProps<{
  events: ShipmentEvent[];
}>();

const progressStates = ['confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'];
const failureStates = ['failed', 'cancelled'];

function getColor(event: ShipmentEvent): string {
  if (progressStates.includes(event.to_state)) return 'bg-green-500';
  if (failureStates.includes(event.to_state)) return 'bg-red-500';
  return 'bg-blue-500';
}

function getBorderColor(event: ShipmentEvent): string {
  if (progressStates.includes(event.to_state)) return 'border-green-500';
  if (failureStates.includes(event.to_state)) return 'border-red-500';
  return 'border-blue-500';
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString();
}

function getPerformedBy(event: ShipmentEvent): string {
  if (event.performed_by_user) {
    return `${event.performed_by_user.first_name} ${event.performed_by_user.last_name}`;
  }
  return 'System';
}
</script>

<template>
  <div class="space-y-0">
    <div v-for="(event, idx) in events" :key="event.id" class="relative flex gap-4">
      <!-- Timeline line -->
      <div class="flex flex-col items-center">
        <div class="w-3 h-3 rounded-full border-2" :class="[getColor(event), getBorderColor(event)]" />
        <div v-if="idx < events.length - 1" class="w-0.5 flex-1 bg-slate-200" />
      </div>
      <!-- Content -->
      <div class="pb-6 flex-1">
        <p class="text-sm font-medium text-slate-900">{{ formatAction(event.action) }}</p>
        <p class="text-xs text-slate-500">
          {{ formatTime(event.created_at) }} &middot; {{ getPerformedBy(event) }}
        </p>
        <p v-if="event.notes" class="mt-1 text-sm text-slate-600">{{ event.notes }}</p>
      </div>
    </div>
  </div>
</template>
