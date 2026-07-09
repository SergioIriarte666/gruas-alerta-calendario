import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('queryClient');

// Prevents firing signOut() repeatedly while multiple queries/mutations
// fail with 401 in the same tick (e.g. after a session expires all at once).
let isHandlingAuthError = false;

export const resetAuthErrorHandling = (): void => {
  isHandlingAuthError = false;
};

const isAuthError = (error: unknown): boolean => {
  const err = error as { status?: number; code?: string; message?: string } | null | undefined;
  if (!err) return false;
  if (err.status === 401) return true;
  if (err.code === 'PGRST301') return true;
  if (typeof err.message === 'string' && /jwt/i.test(err.message)) return true;
  return false;
};

const handleGlobalError = (error: unknown): void => {
  if (!isAuthError(error) || isHandlingAuthError) return;
  isHandlingAuthError = true;
  logger.warn('Sesión expirada detectada (401/JWT), cerrando sesión', error);
  void supabase.auth.signOut();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - serve cached data without refetch
      gcTime: 10 * 60 * 1000, // 10 minutes - keep cache in memory during navigation
      retry: 1,
      refetchOnWindowFocus: false, // Don't refetch on tab focus
    },
  },
  queryCache: new QueryCache({ onError: handleGlobalError }),
  mutationCache: new MutationCache({ onError: handleGlobalError }),
});
