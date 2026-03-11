<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'filter:change': [value: string] }>();

const input = ref(props.modelValue);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(input, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('filter:change', val);
  }, 300);
});
</script>

<template>
  <input
    v-model="input"
    type="text"
    class="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
    placeholder="Filter..."
  />
</template>
