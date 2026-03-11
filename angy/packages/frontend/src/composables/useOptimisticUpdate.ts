import type { Ref } from 'vue';
import { useToastStore } from '@/stores/toast.store';

export function useOptimisticUpdate<T>(
  currentValue: Ref<T>,
  updateFn: (newValue: T) => Promise<unknown>,
) {
  async function apply(newValue: T) {
    const rollbackValue = currentValue.value;
    currentValue.value = newValue;

    try {
      await updateFn(newValue);
    } catch {
      currentValue.value = rollbackValue;
      const toast = useToastStore();
      toast.show('Update failed. Changes have been reverted.', 'error');
    }
  }

  return { apply };
}
