import { ref } from 'vue';

interface UseOptimisticUpdateOptions<TState, TResult> {
  getCurrentState: () => TState;
  applyOptimistic: (state: TState) => void;
  rollback: (previousState: TState) => void;
  apiCall: () => Promise<TResult>;
  onSuccess?: (result: TResult) => void;
  onError?: (error: unknown) => void;
}

export function useOptimisticUpdate() {
  const isPending = ref(false);

  async function execute<TState, TResult>(
    options: UseOptimisticUpdateOptions<TState, TResult>,
  ): Promise<TResult | null> {
    const previousState = structuredClone(options.getCurrentState());
    isPending.value = true;

    // Apply optimistic update immediately
    options.applyOptimistic(previousState);

    try {
      const result = await options.apiCall();
      options.onSuccess?.(result);
      return result;
    } catch (error) {
      // Revert on failure
      options.rollback(previousState);
      options.onError?.(error);
      return null;
    } finally {
      isPending.value = false;
    }
  }

  return { execute, isPending };
}
