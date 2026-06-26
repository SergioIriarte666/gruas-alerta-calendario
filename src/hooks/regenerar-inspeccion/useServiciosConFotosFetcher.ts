import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { ServicioConFotos } from '@/types/regenerar-inspeccion';

const logger = createLogger('RegenerarInspeccion');

export const useServiciosConFotosFetcher = () => {
  return useQuery({
    queryKey: ['regenerar-inspeccion-elegibles'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ServicioConFotos[]> => {
      const { data, error } = await supabase.rpc('get_regenerar_inspeccion_elegibles');

      if (error) {
        logger.error('Error listando servicios con fotos:', error);
        throw new Error(error.message);
      }

      return (data || []).map((row) => ({
        serviceId: row.service_id,
        folio: row.folio,
        serviceDate: row.service_date,
        clientName: row.client_name || 'Sin cliente',
        operatorName: row.operator_name || 'Sin operador',
        fotosDisponibles: row.n_fotos_disponibles || 0,
        tieneRowInspection: Boolean(row.tiene_row_inspection),
        pdfUrlActual: row.pdf_url_actual,
        pdfRetiroUrlActual: row.pdf_retiro_url_actual,
        ultimoEnvioWhatsappAt: row.ultimo_envio_whatsapp_at,
      }));
    },
  });
};
