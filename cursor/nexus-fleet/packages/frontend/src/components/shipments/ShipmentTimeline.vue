<script setup lang="ts">
import { computed } from 'vue'

interface ShipmentEvent {
  id: string
  from_status: string
  to_status: string
  action: string
  user_name?: string | null
  notes?: string | null
  created_at: string
}

const props = defineProps<{
  events: ShipmentEvent[]
}>()

const PROGRESS_STATUSES = new Set([
  'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed',
])
const FAILURE_STATUSES = new Set(['failed', 'cancelled'])

type EventCategory = 'progress' | 'failure' | 'info'

function categorize(toStatus: string): EventCategory {
  if (PROGRESS_STATUSES.has(toStatus)) return 'progress'
  if (FAILURE_STATUSES.has(toStatus)) return 'failure'
  return 'info'
}

const categoryStyles: Record<EventCategory, { ring: string; bg: string; icon: string }> = {
  progress: { ring: 'ring-emerald-200', bg: 'bg-emerald-500', icon: 'text-white' },
  failure: { ring: 'ring-red-200', bg: 'bg-red-500', icon: 'text-white' },
  info: { ring: 'ring-blue-200', bg: 'bg-blue-500', icon: 'text-white' },
}

const badgeStyles: Record<EventCategory, string> = {
  progress: 'bg-emerald-100 text-emerald-800',
  failure: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}

const sortedEvents = computed(() =>
  [...props.events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  ),
)

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="relative">
    <div v-if="!sortedEvents.length" class="py-8 text-center text-sm text-gray-400">
      No events recorded yet.
    </div>

    <div v-else class="space-y-0">
      <div
        v-for="(event, idx) in sortedEvents"
        :key="event.id"
        class="relative flex gap-4 pb-8 last:pb-0"
      >
        <!-- Connector line -->
        <div class="flex flex-col items-center">
          <div
            class="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-4"
            :class="[
              categoryStyles[categorize(event.to_status)].bg,
              categoryStyles[categorize(event.to_status)].ring,
            ]"
          >
            <!-- Progress checkmark -->
            <svg
              v-if="categorize(event.to_status) === 'progress'"
              class="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Failure X -->
            <svg
              v-else-if="categorize(event.to_status) === 'failure'"
              class="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <!-- Info circle -->
            <svg
              v-else
              class="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01" />
            </svg>
          </div>
          <div
            v-if="idx < sortedEvents.length - 1"
            class="w-0.5 flex-1 bg-gray-200"
          />
        </div>

        <!-- Content -->
        <div class="min-w-0 flex-1 pt-0.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
              :class="badgeStyles[categorize(event.to_status)]"
            >
              {{ event.to_status.replace(/_/g, ' ') }}
            </span>
            <span v-if="event.from_status" class="text-xs text-gray-400">
              from {{ event.from_status.replace(/_/g, ' ') }}
            </span>
          </div>

          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <time :datetime="event.created_at">
              {{ formatDate(event.created_at) }} at {{ formatTime(event.created_at) }}
            </time>
            <span v-if="event.user_name" class="flex items-center gap-1">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {{ event.user_name }}
            </span>
          </div>

          <p
            v-if="event.notes"
            class="mt-1.5 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600"
          >
            {{ event.notes }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
