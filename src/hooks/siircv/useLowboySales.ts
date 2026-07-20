import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';
import { saveLowboySaleWithContainers } from '@/services/lowboySaleService';
import {
  ACTIVE_SALE_STATUSES,
  type CreateLowboySaleInput,
  type LowboyContainerSaleAssignment,
  type LowboySaleFormValues,
  type LowboySaleRow,
  type LowboySaleStatus,
} from '@/types/lowboySales';

const logger = createLogger('LowboyVentas');

const QUERY_KEY = ['lowboy-sales'] as const;

const isActive = (status: string) =>
  (ACTIVE_SALE_STATUSES as string[]).includes(status);

/**
 * Orden por defecto: activas (confirmada + ejecutada) primero por fecha
 * comprometida ascendente (lo más próximo arriba); luego el resto por fecha
 * comprometida descendente. Las filas sin fecha se ordenan al final de su grupo.
 */
function sortSales(rows: LowboySaleRow[]): LowboySaleRow[] {
  const rank = (r: LowboySaleRow) => (isActive(r.status) ? 0 : 1);
  return [...rows].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;

    const da = a.scheduled_date ?? '';
    const db = b.scheduled_date ?? '';
    if (ra === 0) {
      // Activas: ascendente, sin fecha al final.
      if (!da) return db ? 1 : 0;
      if (!db) return -1;
      return da.localeCompare(db);
    }
    // Resto: descendente, sin fecha al final.
    if (!da) return db ? 1 : 0;
    if (!db) return -1;
    return db.localeCompare(da);
  });
}

export function useLowboySales() {
  return useQuery({
    queryKey: QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LowboySaleRow[]> => {
      const { data, error } = await supabase
        .from('lowboy_sales')
        .select(`
          *,
          lowboy_containers!lowboy_containers_sale_id_fkey(id, serial_number, size),
          lowboy_sale_vehicles!lowboy_sale_vehicles_sale_id_fkey(id, plate, make, model, position),
          linked_rcv_records:sii_rcv_records!sii_rcv_records_linked_sale_id_fkey(
            id, folio, doc_date, doc_type, counterpart_rut, counterpart_name, net_amount, tax_amount, total_amount
          )
        `)
        .order('scheduled_date', { ascending: true, nullsFirst: false });
      if (error) {
        logger.error('Error cargando ventas Lowboy', error);
        throw error;
      }
      return sortSales((data ?? []) as LowboySaleRow[]);
    },
  });
}

/** Contenedor de una venta Producto con sus costos, para el desglose económico del detalle. */
export type LowboySaleContainerDetail = {
  id: string;
  serial_number: string | null;
  size: string;
  container_type: string;
  condition: string;
  acquisition_net_cost: number;
  sale_net_price: number | null;
  costs: Array<{ id: string; concept: string; net_amount: number; cost_date: string }>;
};

/**
 * Carga perezosa de los contenedores (con costos itemizados) de una venta Producto,
 * para el desglose de costo/margen del modal de detalle. Visible para todos los roles
 * con acceso al módulo (la RLS de lowboy_containers ya lo permite).
 */
export function useLowboySaleContainers(saleId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['lowboy-sale-containers', saleId],
    enabled: enabled && !!saleId,
    staleTime: 60_000,
    queryFn: async (): Promise<LowboySaleContainerDetail[]> => {
      const { data, error } = await supabase
        .from('lowboy_containers')
        .select('id, serial_number, size, container_type, condition, acquisition_net_cost, sale_net_price, costs:lowboy_container_costs(id, concept, net_amount, cost_date)')
        .eq('sale_id', saleId!)
        .order('acquisition_date', { ascending: true });
      if (error) {
        logger.error('Error cargando contenedores de la venta', error);
        throw error;
      }
      return (data ?? []) as LowboySaleContainerDetail[];
    },
  });
}

export type LowboySalesKpis = {
  activeCount: number;
  toInvoice: number;      // ejecutadas (monto por facturar)
  toCollect: number;      // facturadas (monto por cobrar)
  paidThisMonth: number;  // pagadas con ejecución en el mes en curso
};

/** KPIs del estado actual del pipeline, calculados en cliente sobre la lista. */
export function useLowboySalesKpis(sales: LowboySaleRow[] | undefined): LowboySalesKpis {
  return useMemo(() => {
    const rows = sales ?? [];
    const currentMonth = businessClock.today().slice(0, 7); // 'YYYY-MM'
    return rows.reduce<LowboySalesKpis>(
      (acc, sale) => {
        const net = Number(sale.net_amount) || 0;
        if (isActive(sale.status)) acc.activeCount += 1;
        if (sale.status === 'ejecutada') acc.toInvoice += net;
        if (sale.status === 'facturada') acc.toCollect += net;
        if (
          sale.status === 'pagada' &&
          (sale.executed_date ?? '').slice(0, 7) === currentMonth
        ) {
          acc.paidThisMonth += net;
        }
        return acc;
      },
      { activeCount: 0, toInvoice: 0, toCollect: 0, paidThisMonth: 0 },
    );
  }, [sales]);
}

export function useLowboySalesManager() {
  const queryClient = useQueryClient();
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: ['lowboy-containers'] }),
    queryClient.invalidateQueries({ queryKey: ['lowboy-container-sales'] }),
    queryClient.invalidateQueries({ queryKey: ['lowboy', 'sale-candidates'] }),
    queryClient.invalidateQueries({ queryKey: ['sii-rcv'] }),
  ]);

  const createSale = useMutation({
    mutationFn: async ({ values, initialState, containerAssignments, rcvRecordId }: CreateLowboySaleInput) => {
      const id = await saveLowboySaleWithContainers({
        values,
        status: initialState?.status ?? 'confirmada',
        executedDate: initialState?.executed_date,
        containerAssignments,
        rcvRecordId,
      });
      return { id };
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Venta creada correctamente.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible crear la venta', error);
      toast.error(error.message || 'No fue posible crear la venta.');
    },
  });

  const updateSale = useMutation({
    mutationFn: async ({ id, values, status, executedDate, containerAssignments }: { id: string; values: LowboySaleFormValues; status: Exclude<LowboySaleStatus, 'cancelada'>; executedDate?: string | null; containerAssignments?: LowboyContainerSaleAssignment[] }) => {
      await saveLowboySaleWithContainers({ saleId: id, values, status, executedDate, containerAssignments });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Venta actualizada correctamente.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible actualizar la venta', error);
      toast.error(error.message || 'No fue posible actualizar la venta.');
    },
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lowboy_sales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Venta eliminada.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible eliminar la venta', error);
      toast.error(error.message || 'No fue posible eliminar la venta.');
    },
  });

  /** Cambia el estado. Si se pasa `executedDate`, también fija la fecha de ejecución. */
  const setStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      executedDate,
    }: {
      id: string;
      status: LowboySaleStatus;
      executedDate?: string;
    }) => {
      const update: { status: LowboySaleStatus; executed_date?: string } = { status };
      if (executedDate) update.executed_date = executedDate;
      const { error } = await supabase.from('lowboy_sales').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Estado actualizado.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible actualizar el estado', error);
      toast.error(error.message || 'No fue posible actualizar el estado.');
    },
  });

  return { createSale, updateSale, deleteSale, setStatus };
}
