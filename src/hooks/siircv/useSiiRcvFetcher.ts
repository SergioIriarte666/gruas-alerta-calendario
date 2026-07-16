import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { SiiBookType, SiiRcvImportRow, SiiRcvRecordRow } from '@/types/siiRcv';

const logger = createLogger('Lowboy');
const PAGE_SIZE = 1000;
const LOWBOY_RECORD_SELECT = `
  *,
  linked_cost:costs!sii_rcv_records_linked_cost_id_fkey(id, description, amount, date),
  linked_sale:lowboy_sales!sii_rcv_records_linked_sale_id_fkey(
    id, sale_type, client_rut, client_name, description, scheduled_date,
    executed_date, net_amount, status, notes
  ),
  container_purchase_links:lowboy_containers!lowboy_containers_purchase_rcv_record_id_fkey(id),
  container_cost_links:lowboy_container_costs!lowboy_container_costs_rcv_record_id_fkey(id, container_id)
`;

export type SiiRcvFilters = {
  entityRut: string;
  bookType?: SiiBookType;
  desde?: string;
  hasta?: string;
};

export async function fetchSiiRcvRecords(filters: SiiRcvFilters): Promise<SiiRcvRecordRow[]> {
  const rows: SiiRcvRecordRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from('sii_rcv_records')
      .select(LOWBOY_RECORD_SELECT)
      .eq('entity_rut', filters.entityRut)
      .order('doc_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (filters.bookType) query = query.eq('book_type', filters.bookType);
    if (filters.desde) query = query.gte('doc_date', filters.desde);
    if (filters.hasta) query = query.lte('doc_date', filters.hasta);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching sii_rcv_records', error);
      throw error;
    }
    rows.push(...((data ?? []) as SiiRcvRecordRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export function useSiiRcvFetcher(filters: SiiRcvFilters) {
  return useQuery({
    queryKey: ['sii-rcv', filters.entityRut, filters.bookType, filters.desde, filters.hasta],
    queryFn: () => fetchSiiRcvRecords(filters),
    enabled: !!filters.entityRut,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSiiRcvPagedRecords(filters: SiiRcvFilters, page: number, limit: number) {
  return useQuery({
    queryKey: ['sii-rcv', filters.entityRut, filters.bookType, filters.desde, filters.hasta, 'paged', page, limit],
    enabled: !!filters.entityRut,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const offset = (page - 1) * limit;
      let query = supabase
        .from('sii_rcv_records')
        .select(LOWBOY_RECORD_SELECT, { count: 'exact' })
        .eq('entity_rut', filters.entityRut)
        .order('doc_date', { ascending: false })
        .range(offset, offset + limit - 1);
      if (filters.bookType) query = query.eq('book_type', filters.bookType);
      if (filters.desde) query = query.gte('doc_date', filters.desde);
      if (filters.hasta) query = query.lte('doc_date', filters.hasta);

      const { data, error, count } = await query;
      if (error) {
        logger.error('Error fetching paged sii_rcv_records', error);
        throw error;
      }
      const totalCount = count ?? 0;
      return {
        rows: (data ?? []) as SiiRcvRecordRow[],
        totalCount,
        pageCount: Math.max(1, Math.ceil(totalCount / limit)),
      };
    },
  });
}

export function useSiiRcvImportsList(entityRut: string) {
  return useQuery({
    queryKey: ['sii-rcv-imports', entityRut],
    enabled: !!entityRut,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SiiRcvImportRow[]> => {
      const { data, error } = await supabase
        .from('sii_rcv_imports')
        .select('*')
        .eq('entity_rut', entityRut)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}
