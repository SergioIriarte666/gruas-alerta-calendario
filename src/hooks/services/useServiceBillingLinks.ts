import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * ¿Cuáles de estos servicios están vinculados a una factura o a un cierre?
 *
 * Dos consultas para la página completa, no una por fila: el botón "Castigar"
 * solo debe aparecer en servicios sin vínculo de facturación, y averiguarlo
 * fila por fila costaría 2×N consultas por render de la tabla.
 *
 * Es solo para la UI. La verdad la impone `write_off_service`, que vuelve a
 * mirar `invoice_services` y `closure_services` dentro de la transacción.
 */
export const useServiceBillingLinks = (serviceIds: string[]) => {
  const sortedIds = [...serviceIds].sort();

  const { data } = useQuery<Set<string>>({
    queryKey: ['service-billing-links', sortedIds],
    enabled: sortedIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const [invRes, closRes] = await Promise.all([
        supabase.from('invoice_services').select('service_id').in('service_id', sortedIds),
        supabase.from('closure_services').select('service_id').in('service_id', sortedIds),
      ]);

      const linked = new Set<string>();
      (invRes.data || []).forEach((r) => linked.add(r.service_id));
      (closRes.data || []).forEach((r) => linked.add(r.service_id));
      return linked;
    },
  });

  return { linkedServiceIds: data ?? new Set<string>() };
};
