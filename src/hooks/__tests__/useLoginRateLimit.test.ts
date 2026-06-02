import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoginRateLimit } from '../useLoginRateLimit';

const STORAGE_KEY = 'login_rate_limit';

describe('useLoginRateLimit', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('returns not blocked on initial state', () => {
    const { result } = renderHook(() => useLoginRateLimit());

    expect(result.current.isBlocked).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('allows login when no previous failed attempts', () => {
    const { result } = renderHook(() => useLoginRateLimit());

    expect(result.current.isBlocked).toBe(false);
  });

  it('does not block after 1 or 2 failed attempts', () => {
    const { result } = renderHook(() => useLoginRateLimit());

    act(() => {
      result.current.recordFailedAttempt();
    });
    expect(result.current.isBlocked).toBe(false);

    act(() => {
      result.current.recordFailedAttempt();
    });
    expect(result.current.isBlocked).toBe(false);
  });

  it('blocks after 3 failed attempts with 30s cooldown', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const { result } = renderHook(() => useLoginRateLimit());

    act(() => { result.current.recordFailedAttempt(); });
    act(() => { result.current.recordFailedAttempt(); });
    act(() => { result.current.recordFailedAttempt(); });

    expect(result.current.isBlocked).toBe(true);
    expect(result.current.remainingSeconds).toBeGreaterThan(0);
    expect(result.current.remainingSeconds).toBeLessThanOrEqual(30);
  });

  it('blocks for 2 minutes after 5 failed attempts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const { result } = renderHook(() => useLoginRateLimit());

    for (let i = 0; i < 5; i++) {
      act(() => { result.current.recordFailedAttempt(); });
    }

    expect(result.current.isBlocked).toBe(true);
    expect(result.current.remainingSeconds).toBeGreaterThan(0);
    expect(result.current.remainingSeconds).toBeLessThanOrEqual(120);
  });

  it('blocks for 10 minutes after 7 failed attempts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const { result } = renderHook(() => useLoginRateLimit());

    for (let i = 0; i < 7; i++) {
      act(() => { result.current.recordFailedAttempt(); });
    }

    expect(result.current.isBlocked).toBe(true);
    expect(result.current.remainingSeconds).toBeGreaterThan(0);
    expect(result.current.remainingSeconds).toBeLessThanOrEqual(600);
  });

  it('cooldown expires correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const { result } = renderHook(() => useLoginRateLimit());

    act(() => { result.current.recordFailedAttempt(); });
    act(() => { result.current.recordFailedAttempt(); });
    act(() => { result.current.recordFailedAttempt(); });

    expect(result.current.isBlocked).toBe(true);

    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    expect(result.current.isBlocked).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('counter resets after calling resetAttempts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const { result } = renderHook(() => useLoginRateLimit());

    for (let i = 0; i < 4; i++) {
      act(() => { result.current.recordFailedAttempt(); });
    }

    expect(result.current.isBlocked).toBe(true);

    act(() => {
      result.current.resetAttempts();
    });

    expect(result.current.isBlocked).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('persists state across hook re-renders via sessionStorage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const { result, rerender } = renderHook(() => useLoginRateLimit());

    act(() => { result.current.recordFailedAttempt(); });
    act(() => { result.current.recordFailedAttempt(); });

    rerender();

    expect(result.current.isBlocked).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toContain('"attempts":2');
  });

  it('remainingSeconds counts down via interval', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const { result } = renderHook(() => useLoginRateLimit());

    act(() => { result.current.recordFailedAttempt(); });
    act(() => { result.current.recordFailedAttempt(); });
    act(() => { result.current.recordFailedAttempt(); });

    const initialRemaining = result.current.remainingSeconds;
    expect(initialRemaining).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.remainingSeconds).toBe(initialRemaining - 5);
  });
});
