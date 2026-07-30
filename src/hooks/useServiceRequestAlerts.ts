
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/contexts/NotificationContext';
import { useUser } from '@/contexts/UserContext';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceRequestAlerts");
export const useServiceRequestAlerts = () => {
  const { addNotification } = useNotifications();
  const { user } = useUser();

  useEffect(() => {
    // Solo configurar alertas para administradores
    if (user?.role !== 'admin') return;

    const channel = supabase
      .channel('service-requests-alerts')
      // Sin `filter: status=eq.pending`. El filtro server-side lo valida
      // realtime.subscription_check_filters(), que arma la lista de columnas
      // permitidas con has_column_privilege(claims->>'role', …): si el canal se
      // une antes de que el JWT llegue al socket, el rol es `anon` —que no tiene
      // SELECT sobre public.services— y CUALQUIER columna revienta con
      // "invalid column for filter status". El estado se filtra acá.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'services'
        },
        async (payload) => {
          if (payload.new?.status !== 'pending') return;

          logger.debug('Nueva solicitud de servicio detectada:', payload);

          try {
            // Obtener datos del cliente para la notificación
            const { data: serviceData } = await supabase
              .from('services')
              .select(`
                folio,
                origin,
                destination,
                service_date,
                client_id,
                service_type_id
              `)
              .eq('id', payload.new.id)
              .single();

            if (serviceData) {
              // Get client and service type separately
              const [clientRes, serviceTypeRes] = await Promise.all([
                supabase.from('clients').select('name').eq('id', serviceData.client_id).single(),
                supabase.from('service_types').select('name').eq('id', serviceData.service_type_id).single()
              ]);

              addNotification({
                title: 'Nueva Solicitud de Servicio',
                message: `Cliente ${clientRes.data?.name || 'N/A'} ha solicitado servicio ${serviceTypeRes.data?.name || 'N/A'} - Folio: ${serviceData.folio}`,
                type: 'info',
                actionType: 'navigate',
                actionUrl: '/services',
                actionData: { entityId: payload.new.id },
              });
            }
          } catch (error) {
            logger.error('Error procesando alerta de nueva solicitud:', error);
            
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
