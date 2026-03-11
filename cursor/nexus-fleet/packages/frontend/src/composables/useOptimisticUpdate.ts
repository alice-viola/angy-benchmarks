import { useToast } from './useToast';

export function useOptimisticUpdate() {
  const toast = useToast();

  async function execute<S extends Record<string, unknown>, K extends keyof S>(
    store: S,
    key: K,
    optimisticValue: S[K],
    apiCall: () => Promise<S[K]>,
  ): Promise<S[K]> {
    const previous = store[key];
    store[key] = optimisticValue;

    try {
      const result = await apiCall();
      store[key] = result;
      return result;
    } catch (err) {
      store[key] = previous;
      toast.error('Operation failed. Changes have been reverted.');
      throw err;
    }
  }

  return { execute };
}
