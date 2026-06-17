import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useInventoryFix');

export interface InventoryFixResult {
  success: boolean;
  deleted_costs: number;
  updated_crane_parts: number;
  materiales_unit_cost: number;
  message: string;
}

export const useInventoryFix = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<InventoryFixResult | null>(null);

  const execute = async () => {
    setIsExecuting(true);
    try {
      const { data, error } = await supabase.rpc('global_inventory_cleanup');
      if (error) throw error;
      const fixResult = data as unknown as InventoryFixResult;
      setResult(fixResult);
      toast.success('Limpieza global completada exitosamente', {
        description: `Eliminados ${fixResult.deleted_costs || 0} costos duplicados, actualizados ${fixResult.updated_crane_parts || 0} registros`,
      });
    } catch (error: any) {
      logger.error('Error ejecutando limpieza global:', error);
      toast.error('Error al ejecutar limpieza global', {
        description: error.message || 'Error desconocido',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return { execute, isExecuting, result };
};
