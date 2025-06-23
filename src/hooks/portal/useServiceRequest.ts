
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { PortalRequestServiceSchema } from '@/schemas/portalRequestServiceSchema';
import { useToast } from '@/components/ui/custom-toast';
import { useNavigate } from 'react-router-dom';

// Supabase no nos permite insertar un servicio sin estos campos,
// así que debemos proveer valores por defecto. Estos serán
// actualizados por un administrador posteriormente.
const PLACEHOLDER_OPERATOR_ID = '00000000-0000-0000-0000-000000000000';
const PLACEHOLDER_CRANE_ID = '00000000-0000-0000-0000-000000000000';

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
  const folio = `PORTAL-${Date.now()}`;

  const serviceData = {
    // Datos del formulario
    origin: formData.origin,
    destination: formData.destination,
    license_plate: formData.license_plate || null,
    vehicle_brand: formData.vehicle_brand || null,
    vehicle_model: formData.vehicle_model || null,
    observations: formData.observations,
    
    // Datos del sistema
    folio: folio,
    client_id: clientId,
    created_by: userId,
    status: 'pending' as const,
    request_date: new Date().toISOString(),
    service_date: new Date().toISOString(),

    // Usar el tipo de servicio seleccionado
    service_type_id: formData.service_type_id,

    // Datos de marcador de posición
    operator_id: PLACEHOLDER_OPERATOR_ID,
    crane_id: PLACEHOLDER_CRANE_ID,
    value: 0,
  };

  const { data, error } = await supabase.from('services').insert(serviceData);

  if (error) {
    // Podríamos tener un problema si los IDs de placeholder no existen como
    // registros válidos en las tablas referenciadas.
    if (error.code === '23503') { // Foreign key violation
        console.error("Foreign key violation. Check placeholder IDs.", error);
        throw new Error("Error de configuración del sistema. No se pudo crear la solicitud. Contacte a soporte.");
    }
    throw error;
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
      return createServiceRequest({ formData, clientId: profileUser.client_id, userId: profileUser.id });
    },
    onSuccess: () => {
      toast({
        type: 'success',
        title: 'Solicitud Enviada',
        description: 'Hemos recibido tu solicitud de servicio. Pronto será revisada.',
      });
      navigate('/portal/services');
    },
    onError: (error: Error) => {
      toast({
        type: 'error',
        title: 'Error al enviar la solicitud',
        description: error.message || 'Ocurrió un error inesperado.',
      });
    },
  });
};
