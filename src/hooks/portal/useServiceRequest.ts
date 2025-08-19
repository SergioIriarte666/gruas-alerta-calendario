
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { PortalRequestServiceSchema } from '@/schemas/portalRequestServiceSchema';
import { useToast } from '@/components/ui/custom-toast';
import { useNavigate } from 'react-router-dom';

const createServiceRequest = async ({
  formData,
  clientId,
  userId,
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
    request_date: new Date().toISOString(),
    service_date: formData.service_date,
    service_type_id: formData.service_type_id,
    origin: formData.origin,
    destination: formData.destination,
    license_plate: formData.license_plate || '',
    vehicle_brand: formData.vehicle_brand || '',
    vehicle_model: formData.vehicle_model || '',
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
    console.error('Error creating service request:', error);
    throw new Error(`Error al crear la solicitud: ${error.message}`);
  }

  return data;
};

export const useServiceRequest = () => {
  const { user: profileUser } = useUser();
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
          console.log('📧 Enviando email de confirmación de solicitud...');
          await supabase.functions.invoke('send-service-confirmation', {
            body: {
              serviceId: data.id,
              clientEmail: clientData.email,
              folio: data.folio,
              origin: formData.origin,
              destination: formData.destination,
              serviceDate: formData.service_date,
              serviceTypeName: serviceTypeData?.name || 'Servicio de Grúa',
              clientName: clientData.name
            }
          });
          console.log('✅ Email de confirmación enviado exitosamente');
        }

        toast({
          type: 'success',
          title: 'Solicitud Enviada',
          description: `Tu solicitud ${data.folio} ha sido recibida exitosamente. Pronto será revisada y se asignarán los recursos necesarios.`,
        });
      } catch (emailError) {
        console.error('Error enviando email de confirmación:', emailError);
        // No fallar la operación si el email falla
        toast({
          type: 'success',
          title: 'Solicitud Enviada',
          description: `Tu solicitud ${data.folio} ha sido recibida exitosamente. Pronto será revisada.`,
        });
      }
      
      navigate('/portal/services');
    },
    onError: (error: Error) => {
      console.error('Error in service request:', error);
      toast({
        type: 'error',
        title: 'Error al enviar la solicitud',
        description: error.message || 'Ocurrió un error inesperado.',
      });
    },
  });
};
