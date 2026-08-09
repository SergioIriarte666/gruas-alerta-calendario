import { businessClock } from '@/utils/businessClock';

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { PortalRequestServiceSchema } from '@/schemas/portalRequestServiceSchema';
import { normalizeVehicleFreeText } from '@/utils/vehicleCatalogMatch';
import { useToast } from '@/components/ui/custom-toast';
import { useNavigate } from 'react-router-dom';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceRequest");
const createServiceRequest = async ({
  formData,
  clientId,
  userId: _userId,
}: {
  formData: PortalRequestServiceSchema;
  clientId: string;
  userId: string;
}) => {
  // Generar un folio único para la solicitud
  const timestamp = Date.now();
  const folio = `REQ-${timestamp}`;

  // Crear servicio en estado pendiente SIN asignar operador ni grúa
  // Estos se asignarán después por el administrador
  const serviceData = {
    folio: folio,
    client_id: clientId,
    request_date: businessClock.nowISO(),
    service_date: formData.service_date,
    service_type_id: formData.service_type_id,
    origin: formData.origin,
    destination: formData.destination,
    license_plate: formData.license_plate || '',
    vehicle_brand: normalizeVehicleFreeText(formData.vehicle_brand) || '',
    vehicle_model: normalizeVehicleFreeText(formData.vehicle_model) || '',
    contact_phone: formData.contact_phone || null,
    preferred_time: formData.preferred_time || null,
    urgency: formData.urgency || 'normal',
    observations: formData.observations || '',
    status: 'pending' as const,
    value: 0,
    // Estos campos se asignarán después por el administrador
    operator_id: null,
    crane_id: null,
    operator_commission: 0,
  };

  const { data, error } = await supabase
    .from('services')
    .insert(serviceData)
    .select()
    .single();

  if (error) {
    logger.error('Error creating service request:', error);
    
    // Lanzar el error para que lo maneje el createMutationErrorHandler
    throw error;
  }

  return data;
};

export const useServiceRequest = () => {
  const { user: profileUser } = useUser();
  const { createMutationErrorHandler } = useErrorHandler();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (formData: PortalRequestServiceSchema) => {
      if (!profileUser?.id || !profileUser.client_id) {
        throw new Error('No se pudo identificar al cliente. Por favor, inicie sesión de nuevo.');
      }
      return createServiceRequest({ 
        formData, 
        clientId: profileUser.client_id, 
        userId: profileUser.id 
      });
    },
    onSuccess: async (data, formData) => {
      try {
        // Obtener datos del cliente y tipo de servicio para el email
        const { data: clientData } = await supabase
          .from('clients')
          .select('name, email')
          .eq('id', profileUser?.client_id)
          .single();

        const { data: serviceTypeData } = await supabase
          .from('service_types')
          .select('name')
          .eq('id', formData.service_type_id)
          .single();

        // Enviar email de confirmación si el cliente tiene email
        if (clientData?.email && data) {
          logger.debug('📧 Enviando email de confirmación de solicitud...');
          await supabase.functions.invoke('send-service-confirmation', {
            body: {
              serviceId: data.id,
              clientEmail: clientData.email,
              folio: data.folio,
              origin: formData.origin,
              destination: formData.destination,
              serviceDate: formData.service_date,
              serviceTypeName: serviceTypeData?.name || 'Servicio de Grúa',
              clientName: clientData.name,
              urgency: formData.urgency,
              preferredTime: formData.preferred_time,
              contactPhone: formData.contact_phone,
            }
          });
          logger.debug('✅ Email de confirmación enviado exitosamente');
        }

        toast({
          type: 'success',
          title: 'Solicitud Enviada',
          description: `Tu solicitud ${data.folio} ha sido recibida exitosamente. Pronto será revisada y se asignarán los recursos necesarios.`,
        });
      } catch (emailError) {
        logger.error('Error enviando email de confirmación:', emailError);
        // No fallar la operación si el email falla
        toast({
          type: 'success',
          title: 'Solicitud Enviada',
          description: `Tu solicitud ${data.folio} ha sido recibida exitosamente. Pronto será revisada.`,
        });
      }
      
      navigate('/portal/services');
    },
    onError: createMutationErrorHandler({
      title: 'Error al enviar la solicitud',
      context: 'useServiceRequest'
    }),
  });
};
