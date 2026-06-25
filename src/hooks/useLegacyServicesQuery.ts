import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LegacyServicesFilters = {
  dateFrom?: string;
  dateTo?: string;
  insurers?: string[];
  operators?: string[];
  serviceTypes?: string[];
  search?: string;
  page?: number;
  limit?: number;
};

export type LegacyServicesSortColumn =
  | 'received_at'
  | 'manual_folio'
  | 'expediente'
  | 'insurer'
  | 'service_type'
  | 'vehicle_brand'
  | 'license_plate'
  | 'crane_label'
  | 'operator_label'
  | 'total_clp';

export type LegacyServicesSort = {
  column: LegacyServicesSortColumn;
  direction: 'asc' | 'desc';
};

export const DEFAULT_LEGACY_SERVICES_SORT: LegacyServicesSort = {
  column: 'received_at',
  direction: 'desc',
};

export type LegacyServiceRecord = {
  id: string;
  import_id: string | null;
  received_at: string;
  manual_folio: string | null;
  expediente: string | null;
  insurer: string | null;
  service_type: string | null;
  vehicle_brand: string | null;
  vehicle_type: string | null;
  license_plate: string | null;
  vin: string | null;
  origin: string | null;
  destination: string | null;
  crane_label: string | null;
  operator_label: string | null;
  total_clp: number;
  observations: string | null;
  year_month: string | null;
  created_at: string;
};

const cleanSearch = (value = '') => value.trim().replace(/[,()%]/g, ' ').replace(/\s+/g, ' ');

// Supabase's fluent query builders preserve their own generic types through each filter.
// This helper intentionally accepts that builder structurally to keep all consumers identical.
const applyFilters = (query: any, filters: LegacyServicesFilters) => {
  let next = query;
  if (filters.dateFrom) next = next.gte('received_at', `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) next = next.lte('received_at', `${filters.dateTo}T23:59:59.999`);
  if (filters.insurers?.length) next = next.in('insurer', filters.insurers);
  if (filters.operators?.length) next = next.in('operator_label', filters.operators);
  if (filters.serviceTypes?.length) next = next.in('service_type', filters.serviceTypes);
  const search = cleanSearch(filters.search);
  if (search) {
    next = next.or(`license_plate.ilike.%${search}%,manual_folio.ilike.%${search}%,expediente.ilike.%${search}%,origin.ilike.%${search}%,destination.ilike.%${search}%`);
  }
  return next;
};

const applySort = (query: any, sortBy: LegacyServicesSort = DEFAULT_LEGACY_SERVICES_SORT) =>
  query.order(sortBy.column, { ascending: sortBy.direction === 'asc' });

export async function fetchAllLegacyServices(
  filters: LegacyServicesFilters,
  sortBy: LegacyServicesSort = DEFAULT_LEGACY_SERVICES_SORT,
): Promise<LegacyServiceRecord[]> {
  const pageSize = 1000;
  const rows: LegacyServiceRecord[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await applySort(
      applyFilters(
        supabase.from('legacy_services').select('*'),
        filters,
      ),
      sortBy,
    ).range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as LegacyServiceRecord[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export function useLegacyServicesList(
  filters: LegacyServicesFilters,
  sortBy: LegacyServicesSort = DEFAULT_LEGACY_SERVICES_SORT,
) {
  const page = Math.max(1, filters.page ?? 1);
  return useQuery({
    queryKey: ['legacy-services-list', filters, sortBy, page],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const limit = filters.limit ?? 50;
      const offset = (page - 1) * limit;
      const { data, error, count } = await applySort(
        applyFilters(
          supabase.from('legacy_services').select('*', { count: 'exact' }),
          filters,
        ),
        sortBy,
      ).range(offset, offset + limit - 1);
      if (error) throw error;
      const totalCount = count ?? 0;
      return {
        rows: (data ?? []) as LegacyServiceRecord[],
        totalCount,
        pageCount: Math.max(1, Math.ceil(totalCount / limit)),
      };
    },
  });
}

const groupTop = (rows: LegacyServiceRecord[], key: keyof LegacyServiceRecord, limit?: number) => {
  const counts = new Map<string, { count: number; total_clp: number }>();
  rows.forEach((row) => {
    const name = String(row[key] || 'Sin información');
    const current = counts.get(name) ?? { count: 0, total_clp: 0 };
    current.count += 1;
    current.total_clp += Number(row.total_clp || 0);
    counts.set(name, current);
  });
  const sorted = [...counts].map(([name, values]) => ({ name, ...values })).sort((a, b) => b.count - a.count);
  return limit ? sorted.slice(0, limit) : sorted;
};

const groupPie = (rows: LegacyServiceRecord[], key: keyof LegacyServiceRecord, limit = 8) => {
  const sorted = groupTop(rows, key);
  const top = sorted.slice(0, limit);
  const others = sorted.slice(limit).reduce((sum, item) => sum + item.count, 0);
  return others ? [...top, { name: 'Otras', count: others, total_clp: 0 }] : top;
};

export function useLegacyServicesAnalytics(filters: LegacyServicesFilters) {
  const analyticsFilters = { ...filters, page: undefined, limit: undefined };
  return useQuery({
    queryKey: ['legacy-services-analytics', analyticsFilters],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rows = await fetchAllLegacyServices(analyticsFilters);
      const totalAmount = rows.reduce((sum, row) => sum + Number(row.total_clp || 0), 0);
      const byInsurerFull = groupTop(rows, 'insurer');
      const topInsurer = byInsurerFull[0];
      const monthMap = new Map<string, { count: number; total_clp: number }>();
      rows.forEach((row) => {
        const month = row.year_month || row.received_at.slice(0, 7);
        const current = monthMap.get(month) ?? { count: 0, total_clp: 0 };
        current.count += 1;
        current.total_clp += Number(row.total_clp || 0);
        monthMap.set(month, current);
      });
      const byMonth = [...monthMap].map(([month, values]) => ({ month, ...values })).sort((a, b) => a.month.localeCompare(b.month));
      return {
        kpis: {
          total_count: rows.length,
          total_clp: totalAmount,
          avg_clp: rows.length ? Math.round(totalAmount / rows.length) : 0,
          top_insurer_name: topInsurer?.name ?? 'Sin datos',
          top_insurer_pct: rows.length && topInsurer ? (topInsurer.count / rows.length) * 100 : 0,
        },
        byMonth,
        byInsurer: groupPie(rows, 'insurer'),
        byServiceType: groupPie(rows, 'service_type'),
        byOperator: groupTop(rows, 'operator_label', 10),
        byCrane: groupTop(rows, 'crane_label', 10),
      };
    },
  });
}

export function useLegacyImportsList() {
  return useQuery({
    queryKey: ['legacy-imports-list'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legacy_service_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDeleteLegacyImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('legacy_service_imports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['legacy-services-list'] }),
        queryClient.invalidateQueries({ queryKey: ['legacy-services-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['legacy-imports-list'] }),
        queryClient.invalidateQueries({ queryKey: ['legacy-filter-options'] }),
      ]);
    },
  });
}

export function useLegacyFilterOptions() {
  return useQuery({
    queryKey: ['legacy-filter-options'],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const rows = await fetchAllLegacyServices({});
      const unique = (key: keyof LegacyServiceRecord) => [...new Set(rows.map((row) => String(row[key] || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
      return {
        insurers: unique('insurer'),
        operators: unique('operator_label'),
        serviceTypes: unique('service_type'),
      };
    },
  });
}
