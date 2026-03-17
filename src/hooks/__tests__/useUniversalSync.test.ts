import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUniversalSync } from '../useUniversalSync';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useUniversalSync', () => {
  it('returns all invalidation methods', () => {
    const { result } = renderHook(() => useUniversalSync(), {
      wrapper: createWrapper(),
    });

    expect(result.current.invalidateAll).toBeDefined();
    expect(result.current.invalidateInventory).toBeDefined();
    expect(result.current.invalidateCosts).toBeDefined();
    expect(result.current.invalidateCraneParts).toBeDefined();
    expect(result.current.refetchCritical).toBeDefined();
  });

  it('invalidateAll calls without error', () => {
    const { result } = renderHook(() => useUniversalSync(), {
      wrapper: createWrapper(),
    });

    expect(() => result.current.invalidateAll()).not.toThrow();
  });

  it('invalidateInventory calls without error', () => {
    const { result } = renderHook(() => useUniversalSync(), {
      wrapper: createWrapper(),
    });

    expect(() => result.current.invalidateInventory()).not.toThrow();
  });

  it('invalidateCosts calls without error', () => {
    const { result } = renderHook(() => useUniversalSync(), {
      wrapper: createWrapper(),
    });

    expect(() => result.current.invalidateCosts()).not.toThrow();
  });
});
