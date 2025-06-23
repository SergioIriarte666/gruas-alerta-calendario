
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/contexts/NotificationContext';
import { useUser } from '@/contexts/UserContext';

export const useServiceRequestAlerts = () => {
  const { addNotification } = useNotifications();
  const { user } = useUser();

  useEffect(() => {
    // Solo configurar alertas para administradores
    if (user?.role !== 'admin') return;

    const channel = supabase
      .channel('service-requests-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'services',
          filter: 'status=eq.pending'
        },
        async (payload) => {
          console.log('Nueva solicitud de servicio detectada:', payload);
          
          try {
            // Obtener datos del cliente para la notificación
            const { data: serviceData } = await supabase
              .from('services')
              .select(`
                folio,
                origin,
                destination,
                service_date,
                client:clients(name),
                service_type:service_types(name)
              `)
              .eq('id', payload.new.id)
              .single();

            if (serviceData) {
              addNotification({
                title: 'Nueva Solicitud de Servicio',
                message: `Cliente ${serviceData.client?.name} ha solicitado servicio ${serviceData.service_type?.name} - Folio: ${serviceData.folio}`,
                type: 'info',
                actionType: 'navigate',
                actionUrl: '/services',
                actionData: { entityId: payload.new.id },
              });
            }
          } catch (error) {
            console.error('Error procesando alerta de nueva solicitud:', error);
            
            // Notificación básica si falla la obtención de datos
            addNotification({
              title: 'Nueva Solicitud de Servicio',
              message: `Se ha recibido una nueva solicitud de servicio pendiente de revisión.`,
              type: 'info',
              actionType: 'navigate',
              actionUrl: '/services',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.role, addNotification]);
};
