import { useState, useCallback } from 'react';

interface UseApiCallOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number; // milliseconds
}

export function useApiCall<T, Args extends unknown[]>(
  apiFunction: (...args: Args) => Promise<T>,
  options: UseApiCallOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const { onSuccess, onError, retryCount = 0, retryDelay = 1000 } = options;

  const execute = useCallback(async (...args: Args): Promise<T> => {
    setLoading(true);
    setError(null);
    
    let attempt = 0;
    
    const run = async (): Promise<T> => {
      try {
        const result = await apiFunction(...args);
        setData(result);
        onSuccess?.(result);
        setLoading(false);
        return result;
      } catch (err) {
        const errorInstance = err instanceof Error ? err : new Error((err as { message?: string })?.message || String(err));
        if (attempt < retryCount) {
          attempt++;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return run();
        } else {
          setError(errorInstance);
          onError?.(errorInstance);
          setLoading(false);
          throw errorInstance;
        }
      }
    };

    return run();
  }, [apiFunction, onSuccess, onError, retryCount, retryDelay]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  return { data, loading, error, execute, reset };
}
