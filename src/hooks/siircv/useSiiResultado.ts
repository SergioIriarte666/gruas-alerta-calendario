import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { fetchSiiRcvRecords } from './useSiiRcvFetcher';
import { DOC_TYPE_NOTA_CREDITO } from '@/types/siiRcv';
import type { SiiRcvRecordRow } from '@/types/siiRcv';

const logger = createLogger('useSiiResultado');
const COSTS_PAGE_SIZE = 1000;

type CostRow = {
  id: string;
  date: string;
  amount: number;
  category_id: string | null;
  crane_id: string | null;
  cost_categories: { name: string } | null;
  cranes: { license_plate: string; brand: string; model: string } | null;
};

/** Sentinel para agrupar/filtrar costos LowBoy sin crane_id asignado (ej. equipo Fontaine sin patente). */
export const SIN_EQUIPO_SENTINEL = '__sin_equipo__';

// Base determinística: TODOS los costos con entity='lowboy' en el rango, sin importar crane_id.
// El multi-select de equipos en el panel es solo un refinamiento visual sobre este universo.
async function fetchLowboyCosts(desde: string, hasta: string): Promise<CostRow[]> {
  const rows: CostRow[] = [];
  for (let offset = 0; ; offset += COSTS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('costs')
      .select('id, date, amount, category_id, crane_id, cost_categories(name), cranes(license_plate, brand, model)')
      .eq('entity', 'lowboy')
      .gte('date', desde)
      .lte('date', hasta)
      .range(offset, offset + COSTS_PAGE_SIZE - 1);
    if (error) {
      logger.error('Error fetching LowBoy costs', error);
      throw error;
    }
    rows.push(...((data ?? []) as unknown as CostRow[]));
    if (!data || data.length < COSTS_PAGE_SIZE) break;
  }
  return rows;
}

const calcIngresos = (ventaRows: SiiRcvRecordRow[]): number =>
  ventaRows.reduce(
    (sum, row) => sum + (row.doc_type === DOC_TYPE_NOTA_CREDITO ? -Number(row.net_amount) : Number(row.net_amount)),
    0,
  );

export type CostosPorCategoria = { categoryId: string; categoryName: string; total: number; percentage: number };
export type CostosPorEquipo = { craneId: string; licensePlate: string; label: string; total: number };
export type CompraSinCosto = { id: string; docDate: string; counterpartName: string; folio: number; totalAmount: number };

export type SiiResultado = {
  ingresos: number;
  costos: number;
  margen: number;
  margenPct: number;
  costosPorCategoria: CostosPorCategoria[];
  costosPorEquipo: CostosPorEquipo[];
  comprasSinCosto: CompraSinCosto[];
};

export function useSiiResultado(entityRut: string, craneIds: string[], desde: string, hasta: string) {
  return useQuery({
    queryKey: ['sii-resultado', entityRut, craneIds, desde, hasta],
    enabled: !!entityRut && !!desde && !!hasta,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SiiResultado> => {
      const [ventaRows, compraRows, allCostRows] = await Promise.all([
        fetchSiiRcvRecords({ entityRut, bookType: 'venta', desde, hasta }),
        fetchSiiRcvRecords({ entityRut, bookType: 'compra', desde, hasta }),
        fetchLowboyCosts(desde, hasta),
      ]);

      // Refinamiento visual: si hay selección, filtra por equipo (o "sin equipo asignado").
      // Sin selección, muestra el universo completo de costos LowBoy del período.
      const costRows = craneIds.length > 0
        ? allCostRows.filter((cost) => craneIds.includes(cost.crane_id ?? SIN_EQUIPO_SENTINEL))
        : allCostRows;

      const ingresos = calcIngresos(ventaRows);
      const costos = costRows.reduce((sum, cost) => sum + Number(cost.amount), 0);
      const margen = ingresos - costos;
      const margenPct = ingresos !== 0 ? (margen / ingresos) * 100 : 0;

      const categoryMap = new Map<string, CostosPorCategoria>();
      costRows.forEach((cost) => {
        const categoryId = cost.category_id ?? 'sin-categoria';
        const categoryName = cost.cost_categories?.name ?? 'Sin categoría';
        const current = categoryMap.get(categoryId) ?? { categoryId, categoryName, total: 0, percentage: 0 };
        current.total += Number(cost.amount);
        categoryMap.set(categoryId, current);
      });
      const costosPorCategoria = [...categoryMap.values()]
        .map((entry) => ({ ...entry, percentage: costos > 0 ? (entry.total / costos) * 100 : 0 }))
        .sort((a, b) => b.total - a.total);

      const equipoMap = new Map<string, CostosPorEquipo>();
      costRows.forEach((cost) => {
        const key = cost.crane_id ?? SIN_EQUIPO_SENTINEL;
        const current = equipoMap.get(key) ?? {
          craneId: key,
          licensePlate: cost.cranes?.license_plate ?? '',
          label: cost.cranes ? `${cost.cranes.brand} ${cost.cranes.model}` : 'Sin equipo asignado',
          total: 0,
        };
        current.total += Number(cost.amount);
        equipoMap.set(key, current);
      });
      const costosPorEquipo = [...equipoMap.values()].sort((a, b) => b.total - a.total);

      const costsByMonthAmount = new Map<string, Set<number>>();
      costRows.forEach((cost) => {
        const yearMonth = cost.date.slice(0, 7);
        const amounts = costsByMonthAmount.get(yearMonth) ?? new Set<number>();
        amounts.add(Number(cost.amount));
        costsByMonthAmount.set(yearMonth, amounts);
      });
      const comprasSinCosto = compraRows
        .filter((row) => {
          const yearMonth = row.doc_date.slice(0, 7);
          const amounts = costsByMonthAmount.get(yearMonth);
          return !amounts || !amounts.has(Number(row.total_amount));
        })
        .map((row) => ({
          id: row.id,
          docDate: row.doc_date,
          counterpartName: row.counterpart_name ?? row.counterpart_rut,
          folio: row.folio,
          totalAmount: Number(row.total_amount),
        }))
        .sort((a, b) => (a.docDate < b.docDate ? 1 : -1));

      return { ingresos, costos, margen, margenPct, costosPorCategoria, costosPorEquipo, comprasSinCosto };
    },
  });
}
