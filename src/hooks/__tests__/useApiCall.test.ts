import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApiCall } from '../useApiCall';

describe('useApiCall', () => {
  it('should initialize with default states', () => {
    const mockApi = vi.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useApiCall(mockApi));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle successful API execution', async () => {
    const mockApi = vi.fn().mockResolvedValue('data_payload');
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApiCall(mockApi, { onSuccess }));

    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute('arg1');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await promise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('data_payload');
    expect(result.current.error).toBeNull();
    expect(mockApi).toHaveBeenCalledWith('arg1');
    expect(onSuccess).toHaveBeenCalledWith('data_payload');
  });

  it('should handle API execution failure', async () => {
    const errorMsg = new Error('API Error');
    const mockApi = vi.fn().mockRejectedValue(errorMsg);
    const onError = vi.fn();
    const { result } = renderHook(() => useApiCall(mockApi, { onError }));

    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      try {
        await promise;
      } catch (e) {
        // Expected throw
      }
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(errorMsg);
    expect(onError).toHaveBeenCalledWith(errorMsg);
  });

  it('should support resetting states', async () => {
    const mockApi = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useApiCall(mockApi));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBe('data');

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should support retries on failure', async () => {
    let callCount = 0;
    const mockApi = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error('Temporary Fail'));
      }
      return Promise.resolve('Success after retry');
    });

    const { result } = renderHook(() => useApiCall(mockApi, { retryCount: 2, retryDelay: 5 }));

    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });

    await act(async () => {
      await promise;
    });

    expect(result.current.data).toBe('Success after retry');
    expect(result.current.error).toBeNull();
    expect(callCount).toBe(3);
  });
});
