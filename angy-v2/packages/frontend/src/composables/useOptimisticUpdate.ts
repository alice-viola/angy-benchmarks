import { useToast } from './useToast';

export async function useOptimisticUpdate<T>(options: {
  apply: () => void;
  revert: () => void;
  apiCall: () => Promise<T>;
  errorMessage?: string;
}): Promise<T | null> {
  const { addToast } = useToast();

  // Apply optimistic change
  options.apply();

  try {
    const result = await options.apiCall();
    return result;
  } catch (error) {
    // Revert on failure
    options.revert();
    addToast({
      type: 'error',
      title: 'Action Failed',
      message: options.errorMessage || (error instanceof Error ? error.message : 'An error occurred'),
    });
    return null;
  }
}
