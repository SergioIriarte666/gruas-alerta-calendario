import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceSaleMargin {
  saleTotal: number;
  fifoCost: number;
  margin: number;
}

// Costo FIFO real de una venta de productos: suma total_cost de las salidas
// de bodega vinculadas al servicio (inventory_movements.service_id). Estas
// salidas no generan un cost en la categoría Inventario/Mantenimiento (ver
// migración 20260709120000), así que el margen se calcula aquí, no desde costs.
export function useServiceSaleMargin(serviceId: string | undefined, saleTotal: number, enabled: boolean) {
  const query = useQuery({
    queryKey: ['service-sale-margin', serviceId],
    enabled: enabled && !!serviceId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('total_cost')
        .eq('service_id', serviceId!)
        .eq('movement_type', 'exit')
        .eq('status', 'active');

      if (error) throw error;

      return (data || []).reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
    },
  });

  const fifoCost = query.data ?? 0;

  const margin: ServiceSaleMargin = {
    saleTotal,
    fifoCost,
    margin: saleTotal - fifoCost,
  };

  return { ...margin, isLoading: query.isLoading };
}
