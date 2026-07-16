import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { normalizeRut } from '@/utils/rutFormatter';
import { businessClock } from '@/utils/businessClock';
import type { LowboySaleFormValues, LowboySaleInitialState, LowboySaleRow } from '@/types/lowboySales';
import type {
  LowboyContainerCostFormValues,
  LowboyContainerCostRow,
  LowboyContainerFormValues,
  LowboyContainerRcvReference,
  LowboyContainerRow,
} from '@/types/lowboyContainers';
import { containerMargin, containerTotalCost } from '@/types/lowboyContainers';

const logger = createLogger('LowboyContainers');
const CONTAINERS_KEY = ['lowboy-containers'] as const;

const CONTAINER_SELECT = `
  *,
  costs:lowboy_container_costs(*),
  sale:lowboy_sales!lowboy_containers_sale_id_fkey(
    id, client_name, client_rut, description, net_amount, status, scheduled_date, executed_date
  ),
  purchase_rcv:sii_rcv_records!lowboy_containers_purchase_rcv_record_id_fkey(*)
`;

const containerPayload = (values: LowboyContainerFormValues) => ({
  serial_number: values.serial_number.trim() || null,
  size: values.size,
  container_type: values.container_type,
  condition: values.condition,
  acquisition_date: values.acquisition_date,
  supplier_rut: normalizeRut(values.supplier_rut) || null,
  supplier_name: values.supplier_name.trim() || null,
  acquisition_net_cost: values.acquisition_net_cost,
  purchase_rcv_record_id: values.purchase_rcv_record_id || null,
  status: values.status,
  notes: values.notes.trim() || null,
});

const costPayload = (values: LowboyContainerCostFormValues) => ({
  concept: values.concept.trim(),
  net_amount: values.net_amount,
  cost_date: values.cost_date,
  rcv_record_id: values.rcv_record_id || null,
  notes: values.notes.trim() || null,
});

const salePayload = (values: LowboySaleFormValues) => ({
  sale_type: 'producto',
  client_rut: normalizeRut(values.client_rut),
  client_name: values.client_name.trim(),
  description: values.description.trim(),
  origin: null,
  destination: null,
  scheduled_date: values.scheduled_date || null,
  net_amount: values.net_amount,
  notes: values.notes.trim() || null,
});

export function useLowboyContainers() {
  return useQuery({
    queryKey: CONTAINERS_KEY,
    staleTime: 60_000,
    queryFn: async (): Promise<LowboyContainerRow[]> => {
      const { data, error } = await supabase
        .from('lowboy_containers')
        .select(CONTAINER_SELECT)
        .order('acquisition_date', { ascending: false });
      if (error) {
        logger.error('Error cargando contenedores', error);
        throw error;
      }
      return (data ?? []) as LowboyContainerRow[];
    },
  });
}

export type LowboyContainerKpis = {
  availableCount: number;
  availableCapital: number;
  reservedCount: number;
  soldThisYearCount: number;
  soldThisYearMargin: number;
};

export function useLowboyContainerKpis(containers: LowboyContainerRow[] | undefined): LowboyContainerKpis {
  return useMemo(() => {
    const year = businessClock.today().slice(0, 4);
    return (containers ?? []).reduce<LowboyContainerKpis>((kpis, container) => {
      if (container.status === 'disponible') {
        kpis.availableCount += 1;
        kpis.availableCapital += containerTotalCost(container);
      }
      if (container.status === 'reservado') kpis.reservedCount += 1;
      const soldDate = container.sale?.executed_date ?? container.sale?.scheduled_date ?? container.updated_at;
      if (container.status === 'vendido' && soldDate.startsWith(year)) {
        kpis.soldThisYearCount += 1;
        kpis.soldThisYearMargin += containerMargin(container);
      }
      return kpis;
    }, {
      availableCount: 0,
      availableCapital: 0,
      reservedCount: 0,
      soldThisYearCount: 0,
      soldThisYearMargin: 0,
    });
  }, [containers]);
}

export function useLowboyContainerRcvCandidates(enabled = true) {
  return useQuery({
    queryKey: ['lowboy-container-rcv-candidates'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LowboyContainerRcvReference[]> => {
      const { data, error } = await supabase
        .from('sii_rcv_records')
        .select('*')
        .eq('entity_rut', '78.387.656-6')
        .eq('book_type', 'compra')
        .order('doc_date', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LowboyContainerRcvReference[];
    },
  });
}

export function useLowboyContainerSales(enabled = true) {
  return useQuery({
    queryKey: ['lowboy-container-sales'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<LowboySaleRow[]> => {
      const { data, error } = await supabase
        .from('lowboy_sales')
        .select(`
          *,
          linked_rcv_records:sii_rcv_records!sii_rcv_records_linked_sale_id_fkey(id, folio, doc_date, net_amount),
          lowboy_containers!lowboy_containers_sale_id_fkey(id, sale_net_price)
        `)
        .eq('sale_type', 'producto')
        .neq('status', 'cancelada')
        .order('scheduled_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as LowboySaleRow[];
    },
  });
}

export type LowboyContainerInvoiceCandidate = Pick<LowboyContainerRcvReference,
  'id' | 'folio' | 'doc_date' | 'counterpart_rut' | 'counterpart_name' | 'net_amount' | 'total_amount'>;

export function useLowboyContainerInvoiceCandidates(enabled = true) {
  return useQuery({
    queryKey: ['lowboy-container-invoice-candidates'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<LowboyContainerInvoiceCandidate[]> => {
      const { data, error } = await supabase
        .from('sii_rcv_records')
        .select('id, folio, doc_date, counterpart_rut, counterpart_name, net_amount, total_amount')
        .eq('entity_rut', '78.387.656-6')
        .eq('book_type', 'venta')
        .is('linked_sale_id', null)
        .order('doc_date', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LowboyContainerInvoiceCandidate[];
    },
  });
}

export function useLowboyContainersManager() {
  const queryClient = useQueryClient();
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: CONTAINERS_KEY }),
    queryClient.invalidateQueries({ queryKey: ['lowboy-container-sales'] }),
    queryClient.invalidateQueries({ queryKey: ['lowboy-sales'] }),
    queryClient.invalidateQueries({ queryKey: ['sii-rcv'] }),
    queryClient.invalidateQueries({ queryKey: ['lowboy-container-invoice-candidates'] }),
    queryClient.invalidateQueries({ queryKey: ['lowboy', 'sale-candidates'] }),
  ]);

  const createContainer = useMutation({
    mutationFn: async (values: LowboyContainerFormValues) => {
      const { error } = await supabase.from('lowboy_containers').insert(containerPayload(values));
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast.success('Contenedor creado.'); },
    onError: (error: Error) => { logger.error('No fue posible crear el contenedor', error); toast.error(error.message); },
  });

  const updateContainer = useMutation({
    mutationFn: async ({ id, values, preserveSoldStatus = false }: { id: string; values: LowboyContainerFormValues; preserveSoldStatus?: boolean }) => {
      const payload = containerPayload(values);
      const update = preserveSoldStatus
        ? (({ status: _status, ...rest }) => rest)(payload)
        : payload;
      const { error } = await supabase.from('lowboy_containers').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast.success('Contenedor actualizado.'); },
    onError: (error: Error) => { logger.error('No fue posible actualizar el contenedor', error); toast.error(error.message); },
  });

  const deleteContainer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lowboy_containers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast.success('Contenedor eliminado.'); },
    onError: (error: Error) => { logger.error('No fue posible eliminar el contenedor', error); toast.error(error.message); },
  });

  const saveCost = useMutation({
    mutationFn: async ({ containerId, costId, values }: { containerId: string; costId?: string; values: LowboyContainerCostFormValues }) => {
      if (costId) {
        const { error } = await supabase.from('lowboy_container_costs').update(costPayload(values)).eq('id', costId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lowboy_container_costs').insert({ container_id: containerId, ...costPayload(values) });
        if (error) throw error;
      }
    },
    onSuccess: async () => { await invalidate(); toast.success('Costo guardado.'); },
    onError: (error: Error) => { logger.error('No fue posible guardar el costo', error); toast.error(error.message); },
  });

  const deleteCost = useMutation({
    mutationFn: async (cost: LowboyContainerCostRow) => {
      const { error } = await supabase.from('lowboy_container_costs').delete().eq('id', cost.id);
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast.success('Costo eliminado.'); },
    onError: (error: Error) => { logger.error('No fue posible eliminar el costo', error); toast.error(error.message); },
  });

  const setReservation = useMutation({
    mutationFn: async ({ id, reserved }: { id: string; reserved: boolean }) => {
      const { error } = await supabase
        .from('lowboy_containers')
        .update({ status: reserved ? 'reservado' : 'disponible' })
        .eq('id', id)
        .is('sale_id', null);
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast.success('Estado actualizado.'); },
    onError: (error: Error) => { logger.error('No fue posible cambiar la reserva', error); toast.error(error.message); },
  });

  const linkSale = useMutation({
    mutationFn: async ({ containerId, saleId, saleNetPrice, rcvRecordId, markAsInvoiced = false }: { containerId: string; saleId: string; saleNetPrice: number; rcvRecordId?: string; markAsInvoiced?: boolean }) => {
      const { error } = await supabase.rpc('sell_lowboy_container', {
        p_container_id: containerId,
        p_sale_id: saleId,
        p_sale_net_price: saleNetPrice,
        p_rcv_record_id: rcvRecordId,
        p_mark_as_invoiced: markAsInvoiced,
      });
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast.success('Contenedor asociado a la venta.'); },
    onError: (error: Error) => { logger.error('No fue posible vender el contenedor', error); toast.error(error.message); },
  });

  const createSaleAndLink = useMutation({
    mutationFn: async ({ containerId, values, initialState, rcvRecordId }: { containerId: string; values: LowboySaleFormValues; initialState?: LowboySaleInitialState; rcvRecordId?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: sale, error: saleError } = await supabase
        .from('lowboy_sales')
        .insert({
          ...salePayload(values),
          status: initialState?.status ?? 'confirmada',
          executed_date: initialState?.executed_date ?? null,
          created_by: auth.user?.id ?? null,
        })
        .select('id, net_amount')
        .single();
      if (saleError) throw saleError;

      const { error: containerError } = await supabase.rpc('sell_lowboy_container', {
        p_container_id: containerId,
        p_sale_id: sale.id,
        p_sale_net_price: sale.net_amount,
        p_rcv_record_id: rcvRecordId,
        p_mark_as_invoiced: false,
      });
      if (containerError) {
        await supabase.from('lowboy_sales').delete().eq('id', sale.id);
        throw containerError;
      }
    },
    onSuccess: async () => { await invalidate(); toast.success('Venta creada y contenedor vendido.'); },
    onError: (error: Error) => { logger.error('No fue posible crear la venta del contenedor', error); toast.error(error.message); },
  });

  return {
    createContainer,
    updateContainer,
    deleteContainer,
    saveCost,
    deleteCost,
    setReservation,
    linkSale,
    createSaleAndLink,
  };
}
