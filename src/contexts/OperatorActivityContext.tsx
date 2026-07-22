import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { createLogger } from '@/lib/logger';
import type {
  OperatorActivity,
  OperatorActivityConnection,
  OperatorActivityCursor,
} from '@/types/operatorActivity';

const logger = createLogger('OperatorActivity');
const PAGE_SIZE = 20;

interface ActivityPage {
  items: OperatorActivity[];
  nextCursor: OperatorActivityCursor | null;
}

interface OperatorActivityContextValue {
  activities: OperatorActivity[];
  recentActivities: OperatorActivity[];
  unreadCount: number;
  connection: OperatorActivityConnection;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: Error | null;
  fetchNextPage: () => Promise<unknown>;
  refresh: () => Promise<unknown>;
  markAllRead: () => Promise<void>;
  isMarkingRead: boolean;
}

const OperatorActivityContext = createContext<OperatorActivityContextValue | null>(null);

const activityKeys = {
  feed: (operatorId?: string | null) => ['operator-activity', 'feed', operatorId ?? null] as const,
  unread: (operatorId?: string | null) => ['operator-activity', 'unread', operatorId ?? null] as const,
};

export const OperatorActivityProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const operatorId = user?.operator_id;
  const [connection, setConnection] = useState<OperatorActivityConnection>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting',
  );

  const feedQuery = useInfiniteQuery({
    queryKey: activityKeys.feed(operatorId),
    enabled: Boolean(operatorId),
    initialPageParam: null as OperatorActivityCursor | null,
    queryFn: async ({ pageParam }): Promise<ActivityPage> => {
      let query = supabase
        .from('operator_activity_events')
        .select('*')
        .eq('operator_id', operatorId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (pageParam) {
        query = query.or(
          `created_at.lt.${pageParam.createdAt},and(created_at.eq.${pageParam.createdAt},id.lt.${pageParam.id})`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as OperatorActivity[];
      const hasMore = rows.length > PAGE_SIZE;
      const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
      const last = items.at(-1);

      return {
        items,
        nextCursor: hasMore && last ? { createdAt: last.created_at, id: last.id } : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const unreadQuery = useQuery({
    queryKey: activityKeys.unread(operatorId),
    enabled: Boolean(operatorId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('operator_activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('operator_id', operatorId!)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 15_000,
  });

  const refresh = useCallback(async () => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: activityKeys.feed(operatorId) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.unread(operatorId) }),
    ]);
  }, [operatorId, queryClient]);

  useEffect(() => {
    if (!operatorId) return;

    const handleOffline = () => setConnection('offline');
    const handleOnline = () => {
      setConnection('connecting');
      void refresh();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const channel = supabase
      .channel(`operator-activity-${operatorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operator_activity_events', filter: `operator_id=eq.${operatorId}` },
        () => { void refresh(); },
      )
      .subscribe((status) => {
        if (!navigator.onLine) setConnection('offline');
        else if (status === 'SUBSCRIBED') setConnection('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnection('error');
        else setConnection('connecting');
      });

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      void supabase.removeChannel(channel);
    };
  }, [operatorId, refresh]);

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_operator_activity_read');
      if (error) throw error;
    },
    onSuccess: () => { void refresh(); },
    onError: (error) => logger.error('No se pudo marcar la actividad como leída', error),
  });

  const activities = useMemo(() => {
    const seen = new Set<string>();
    return (feedQuery.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [feedQuery.data]);

  const value = useMemo<OperatorActivityContextValue>(() => ({
    activities,
    recentActivities: activities.slice(0, 3),
    unreadCount: unreadQuery.data ?? 0,
    connection,
    isLoading: feedQuery.isLoading,
    isFetchingNextPage: feedQuery.isFetchingNextPage,
    hasNextPage: Boolean(feedQuery.hasNextPage),
    error: feedQuery.error instanceof Error ? feedQuery.error : null,
    fetchNextPage: feedQuery.fetchNextPage,
    refresh,
    markAllRead: async () => { await markReadMutation.mutateAsync(); },
    isMarkingRead: markReadMutation.isPending,
  }), [
    activities, connection, feedQuery.error, feedQuery.fetchNextPage, feedQuery.hasNextPage,
    feedQuery.isFetchingNextPage, feedQuery.isLoading, markReadMutation, refresh, unreadQuery.data,
  ]);

  return <OperatorActivityContext.Provider value={value}>{children}</OperatorActivityContext.Provider>;
};

export const useOperatorActivity = () => {
  const context = useContext(OperatorActivityContext);
  if (!context) throw new Error('useOperatorActivity debe usarse dentro de OperatorActivityProvider');
  return context;
};
