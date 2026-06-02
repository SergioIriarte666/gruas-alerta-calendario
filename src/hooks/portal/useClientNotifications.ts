import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useClientNotifications');

const STATUS_MESSAGES: Record<string, string> = {
  in_progress: 'Tu grua esta en camino',
  completed: 'Tu servicio ha sido completado',
  cancelled: 'Tu servicio fue cancelado',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En camino',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const useClientNotifications = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || user.role !== 'client' || !user.client_id) return;

    const channel = supabase
      .channel(`client-services-${user.client_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'services',
          filter: `client_id=eq.${user.client_id}`,
        },
        (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          const folio = payload.new?.folio;

          if (!folio || oldStatus === newStatus) return;

          queryClient.invalidateQueries({ queryKey: ['clientServices', user.client_id] });

          const message = STATUS_MESSAGES[newStatus];
          if (message) {
            toast.info(`Servicio ${folio}`, {
              description: message,
            });
          }

          if ('serviceWorker' in navigator && 'PushManager' in window) {
            supabase.functions.invoke('send-push-notification', {
              body: {
                userId: user.id,
                notification: {
                  title: `Servicio ${folio}`,
                  body: message || `Estado actualizado a: ${STATUS_LABELS[newStatus] || newStatus}`,
                  type: 'service_status_update',
                  data: {
                    serviceId: payload.new.id,
                    folio,
                    status: newStatus,
                  },
                },
              },
            }).catch((error) => {
              logger.warn('Push notification failed (non-critical):', error);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
};
