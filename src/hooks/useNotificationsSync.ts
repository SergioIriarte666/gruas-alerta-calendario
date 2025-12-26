import { useEffect, useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Notification, NotificationSummary, NotificationFilters } from '@/types/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DBNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: number;
  group_key: string | null;
  group_count: number | null;
  action_type: string | null;
  action_url: string | null;
  action_data: any;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  snoozed_until: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

const mapDBToNotification = (dbNotification: DBNotification): Notification => ({
  id: dbNotification.id,
  user_id: dbNotification.user_id,
  title: dbNotification.title,
  message: dbNotification.message,
  type: dbNotification.type as Notification['type'],
  category: (dbNotification.category || 'system') as Notification['category'],
  priority: (dbNotification.priority || 4) as Notification['priority'],
  timestamp: new Date(dbNotification.created_at),
  read: !!dbNotification.read_at,
  read_at: dbNotification.read_at,
  dismissed_at: dbNotification.dismissed_at,
  snoozed_until: dbNotification.snoozed_until,
  expires_at: dbNotification.expires_at,
  group_key: dbNotification.group_key,
  group_count: dbNotification.group_count ?? 1,
  actionType: dbNotification.action_type as Notification['actionType'],
  actionUrl: dbNotification.action_url ?? undefined,
  actionData: dbNotification.action_data,
  entity_type: dbNotification.entity_type ?? undefined,
  entity_id: dbNotification.entity_id ?? undefined,
  created_at: dbNotification.created_at,
});

export const useNotificationsSync = (filters?: NotificationFilters) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [realtimeNotification, setRealtimeNotification] = useState<Notification | null>(null);

  // Fetch notifications from database
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      if (filters?.status === 'unread') {
        query = query.is('read_at', null);
      } else if (filters?.status === 'read') {
        query = query.not('read_at', 'is', null);
      }
      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,message.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      return (data || []).map(mapDBToNotification);
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Get notification summary
  const { data: summary } = useQuery({
    queryKey: ['notification-summary', user?.id],
    queryFn: async (): Promise<NotificationSummary> => {
      if (!user?.id) return { total_count: 0, unread_count: 0, critical_count: 0, categories: {} };

      const { data, error } = await supabase.rpc('get_notification_summary');

      if (error) {
        console.error('Error fetching notification summary:', error);
        return { total_count: 0, unread_count: 0, critical_count: 0, categories: {} };
      }

      const result = data?.[0];
      return {
        total_count: result?.total_count || 0,
        unread_count: result?.unread_count || 0,
        critical_count: result?.critical_count || 0,
        categories: (result?.categories as Record<string, number>) || {},
      };
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    },
  });

  // Dismiss notification mutation
  const dismissMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    },
  });

  // Dismiss all notifications mutation
  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('dismissed_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = mapDBToNotification(payload.new as DBNotification);
          setRealtimeNotification(newNotification);
          
          // Show toast for new notifications
          toast(newNotification.title, {
            description: newNotification.message,
            duration: 5000,
          });

          // Invalidate queries
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = useCallback((id: string) => {
    markAsReadMutation.mutate(id);
  }, [markAsReadMutation]);

  const markAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  const dismissNotification = useCallback((id: string) => {
    dismissMutation.mutate(id);
  }, [dismissMutation]);

  const dismissAllNotifications = useCallback(() => {
    dismissAllMutation.mutate();
  }, [dismissAllMutation]);

  return {
    notifications,
    summary,
    loading: isLoading,
    unreadCount: summary?.unread_count || notifications.filter(n => !n.read).length,
    criticalCount: summary?.critical_count || 0,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    dismissAllNotifications,
    refetch,
    realtimeNotification,
  };
};
