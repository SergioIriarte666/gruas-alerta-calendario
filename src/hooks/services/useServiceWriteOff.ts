import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { Service } from '@/types';

const logger = createLogger('ServiceWriteOff');

/**
 * Castigo formal de servicios incobrables.
 *
 * Las dos operaciones pasan por RPC a propósito: el motivo obligatorio, el
 * chequeo de rol admin, la exigencia de estado 'completed' sin vínculo a
 * factura ni cierre, y la fila en `audit_log` los garantiza el servidor. Este
 * hook solo traduce el error de Postgres a una frase y refresca las vistas.
 */
export const useServiceWriteOff = () => {
  const queryClient = useQueryClient();
  const [isWritingOff, setIsWritingOff] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Los reportes y el wizard de cierres se alimentan de ['services'] (o
  // consultan la base al abrirse), así que invalidar esa llave alcanza.
  const invalidate = async (serviceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['services'] }),
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceId] }),
      queryClient.invalidateQueries({ queryKey: ['service-dependencies', serviceId] }),
      queryClient.invalidateQueries({ queryKey: ['audit-log'] }),
    ]);
  };

  const writeOffService = async (service: Service, reason: string): Promise<boolean> => {
    setIsWritingOff(true);
    try {
      const { error } = await supabase.rpc('write_off_service', {
        p_service_id: service.id,
        p_reason: reason,
      });
      if (error) throw error;

      await invalidate(service.id);
      toast.success(`Servicio ${service.folio} castigado`, {
        description: 'Queda fuera de pendientes de facturar y registrado en la auditoría.',
      });
      return true;
    } catch (error) {
      logger.error('Error castigando servicio:', error);
      toast.error('No se pudo castigar el servicio', {
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      return false;
    } finally {
      setIsWritingOff(false);
    }
  };

  const revertWriteOff = async (service: Service): Promise<boolean> => {
    setIsReverting(true);
    try {
      const { error } = await supabase.rpc('revert_write_off', {
        p_service_id: service.id,
      });
      if (error) throw error;

      await invalidate(service.id);
      toast.success(`Castigo de ${service.folio} revertido`, {
        description: 'El servicio vuelve a estado completado.',
      });
      return true;
    } catch (error) {
      logger.error('Error revirtiendo castigo:', error);
      toast.error('No se pudo revertir el castigo', {
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      return false;
    } finally {
      setIsReverting(false);
    }
  };

  return { writeOffService, revertWriteOff, isWritingOff, isReverting };
};
