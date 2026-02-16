
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
