import { useState, useEffect } from 'react';

const STORAGE_KEY = 'login_rate_limit';

interface RateLimitState {
  attempts: number;
  blockedUntil: number | null;
}

function getCooldownSeconds(attempts: number): number {
  if (attempts >= 7) return 10 * 60;
  if (attempts >= 5) return 2 * 60;
  if (attempts >= 3) return 30;
  return 0;
}

function loadState(): RateLimitState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, blockedUntil: null };
    return JSON.parse(raw) as RateLimitState;
  } catch {
    return { attempts: 0, blockedUntil: null };
  }
}

function saveState(state: RateLimitState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage not available — degrade gracefully
  }
}

export function useLoginRateLimit() {
  const [state, setState] = useState<RateLimitState>(loadState);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const isBlocked = state.blockedUntil !== null && Date.now() < state.blockedUntil;

  useEffect(() => {
    if (state.blockedUntil === null) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = Math.ceil((state.blockedUntil! - Date.now()) / 1000);
      if (remaining <= 0) {
        setRemainingSeconds(0);
        setState(prev => {
          if (prev.blockedUntil === null) return prev;
          const next = { ...prev, blockedUntil: null };
          saveState(next);
          return next;
        });
      } else {
        setRemainingSeconds(remaining);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.blockedUntil]);

  const recordFailedAttempt = () => {
    setState(prev => {
      const newAttempts = prev.attempts + 1;
      const cooldown = getCooldownSeconds(newAttempts);
      const blockedUntil = cooldown > 0 ? Date.now() + cooldown * 1000 : null;
      const next: RateLimitState = { attempts: newAttempts, blockedUntil };
      saveState(next);
      return next;
    });
  };

  const resetAttempts = () => {
    const next: RateLimitState = { attempts: 0, blockedUntil: null };
    saveState(next);
    setState(next);
    setRemainingSeconds(0);
  };

  return { isBlocked, remainingSeconds, recordFailedAttempt, resetAttempts };
}
