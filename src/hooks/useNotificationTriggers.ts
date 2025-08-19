
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useQueryClient } from '@tanstack/react-query';

interface NotificationTrigger {
  type: 'service_assigned' | 'service_completed' | 'inspection_ready' | 'invoice_generated';
  title: string;
  body: string;
  data?: any;
}

export const useNotificationTriggers = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Canal para servicios - solo para operadores
    if (user.role === 'operator') {
      const servicesChannel = supabase
        .channel('operator-services')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'services',
            filter: `operator_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Service updated for operator:', payload);
            
            // Invalidar cache de servicios del operador
            queryClient.invalidateQueries({ queryKey: ['operator-services'] });
            
            // Enviar notificación push si es relevante
            if (payload.new.status !== payload.old.status) {
              sendPushNotification({
                type: 'service_assigned',
                title: 'Actualización de Servicio',
                body: `Tu servicio ${payload.new.folio} cambió a: ${payload.new.status}`,
                data: { serviceId: payload.new.id, folio: payload.new.folio }
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'services',
            filter: `operator_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New service assigned to operator:', payload);
            
            queryClient.invalidateQueries({ queryKey: ['operator-services'] });
            
            sendPushNotification({
              type: 'service_assigned',
              title: '🚛 Nuevo Servicio Asignado',
              body: `Se te ha asignado el servicio ${payload.new.folio}`,
              data: { serviceId: payload.new.id, folio: payload.new.folio }
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(servicesChannel);
      };
    }

    // Canal para administradores - notificaciones generales
    if (user.role === 'admin') {
      const adminChannel = supabase
        .channel('admin-notifications')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'services',
            filter: 'status=eq.completed'
          },
          (payload) => {
            if (payload.old.status !== 'completed') {
              console.log('Service completed:', payload);
              
              queryClient.invalidateQueries({ queryKey: ['services'] });
              
              sendPushNotification({
                type: 'service_completed',
                title: '✅ Servicio Completado',
                body: `El servicio ${payload.new.folio} ha sido completado`,
                data: { serviceId: payload.new.id, folio: payload.new.folio }
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'invoices'
          },
          (payload) => {
            console.log('New invoice created:', payload);
            
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            
            sendPushNotification({
              type: 'invoice_generated',
              title: '💰 Nueva Factura Generada',
              body: `Factura ${payload.new.folio} creada exitosamente`,
              data: { invoiceId: payload.new.id, folio: payload.new.folio }
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(adminChannel);
      };
    }

    // Canal para clientes - notificaciones de sus servicios
    if (user.role === 'client' && user.client_id) {
      const clientChannel = supabase
        .channel('client-services')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'services',
            filter: `client_id=eq.${user.client_id}`
          },
          (payload) => {
            console.log('Client service updated:', payload);
            
            queryClient.invalidateQueries({ queryKey: ['client-services'] });
            
            if (payload.new.status === 'completed' && payload.old.status !== 'completed') {
              sendPushNotification({
                type: 'service_completed',
                title: '🎉 Servicio Completado',
                body: `Tu servicio ${payload.new.folio} ha sido completado`,
                data: { serviceId: payload.new.id, folio: payload.new.folio }
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(clientChannel);
      };
    }
  }, [user, queryClient]);

  const sendPushNotification = async (notification: NotificationTrigger) => {
    if (!user) return;

    try {
      // Verificar si el usuario tiene notificaciones habilitadas
      if ('Notification' in window && Notification.permission === 'granted') {
        // Enviar notificación local inmediata
        const localNotification = new Notification(notification.title, {
          body: notification.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          tag: `${notification.type}-${Date.now()}`,
          data: notification.data,
          requireInteraction: notification.type === 'service_assigned'
        });

        localNotification.onclick = () => {
          window.focus();
          localNotification.close();
          
          // Navegar según el tipo de notificación
          if (notification.data?.serviceId) {
            if (user.role === 'operator') {
              window.location.href = '/operator';
            } else {
              window.location.href = '/services';
            }
          }
        };
      }

      // Enviar también push notification a través del servidor
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          notification: {
            title: notification.title,
            body: notification.body,
            data: notification.data,
            type: notification.type
          }
        }
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

  return { sendPushNotification };
};
