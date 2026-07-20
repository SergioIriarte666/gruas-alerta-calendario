import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { addMonths, monthStart } from '@/utils/ivaF29Utils';
import type { IvaF29InvoiceRow, IvaF29MonthSummary, IvaF29Result } from '@/types/ivaF29';

const logger = createLogger('IvaF29');

/** Nº de meses del comparativo (incluye el período seleccionado). */
const COMPARISON_MONTHS = 6;

/** Fila cruda desde la BD para el cálculo del F29. */
type RawInvoice = {
  id: string;
  folio: string;
  numero_fiscal: string | null;
  issue_date: string;
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  status: string | null;
  client: { name: string | null } | null;
};

const emptySummary = (month: string): IvaF29MonthSummary => ({
  month,
  ventasNetas: 0,
  ivaDebito: 0,
  ivaCobrado: 0,
  count: 0,
});

/**
 * Calcula el IVA débito fiscal (F29) del período y el comparativo de los últimos
 * 6 meses sobre las facturas de clientes vigentes (no anuladas, no históricas).
 *
 * Anulación: se excluye por status='cancelled' Y por presencia en
 * invoice_cancellations (doble resguardo — si el status quedara desincronizado
 * respecto a la nota de crédito registrada, la factura igual se excluye).
 */
async function fetchIvaF29(period: string): Promise<IvaF29Result> {
  // Ventana: 6 meses que terminan en el período seleccionado, [inicio, fin).
  const windowStart = monthStart(addMonths(period, -(COMPARISON_MONTHS - 1)));
  const windowEnd = monthStart(addMonths(period, 1));

  // Facturas del rango. issue_date es columna date: el mes se extrae como string
  // ('YYYY-MM'), nunca con new Date(), para no arrastrar corrimientos de zona.
  const { data, error } = await supabase
    .from('invoices')
    .select(
      `id, folio, numero_fiscal, issue_date, subtotal, vat, total, status,
       client:clients!invoices_client_id_fkey ( name )`,
    )
    .gte('issue_date', windowStart)
    .lt('issue_date', windowEnd)
    .neq('status', 'cancelled')
    .not('folio', 'like', 'HIST-%')
    .order('issue_date', { ascending: false })
    .range(0, 4999);

  if (error) {
    logger.error('Error obteniendo facturas para IVA F29', error);
    throw error;
  }

  // Segundo resguardo contra anuladas sin marcar: ids con nota de crédito.
  const { data: cancelledRows, error: cancelledError } = await supabase
    .from('invoice_cancellations')
    .select('invoice_id');
  if (cancelledError) {
    logger.error('Error obteniendo anulaciones para IVA F29', cancelledError);
    throw cancelledError;
  }
  const cancelledIds = new Set((cancelledRows ?? []).map((row) => row.invoice_id));

  const rows = ((data ?? []) as RawInvoice[]).filter((row) => !cancelledIds.has(row.id));

  // Agregación por mes para el comparativo.
  const byMonth = new Map<string, IvaF29MonthSummary>();
  const detail: IvaF29InvoiceRow[] = [];

  for (const row of rows) {
    const month = row.issue_date.slice(0, 7);
    const neto = Number(row.subtotal || 0);
    const iva = Number(row.vat || 0);
    const paid = row.status === 'paid';

    const acc = byMonth.get(month) ?? emptySummary(month);
    acc.ventasNetas += neto;
    acc.ivaDebito += iva;
    acc.ivaCobrado += paid ? iva : 0;
    acc.count += 1;
    byMonth.set(month, acc);

    if (month === period) {
      detail.push({
        id: row.id,
        folio: row.folio,
        numeroFiscal: row.numero_fiscal,
        clientName: row.client?.name ?? 'Cliente no encontrado',
        issueDate: row.issue_date,
        neto,
        iva,
        total: Number(row.total || 0),
        paid,
        status: row.status ?? 'draft',
        ivaSeparated: false,
      });
    }
  }

  // Marcas manuales "IVA apartado" (tabla iva_f29_separations) para el detalle del período.
  const periodIds = detail.map((d) => d.id);
  if (periodIds.length > 0) {
    const { data: sepData, error: sepError } = await supabase
      .from('iva_f29_separations')
      .select('invoice_id')
      .in('invoice_id', periodIds);
    if (sepError) {
      logger.error('Error obteniendo separaciones de IVA F29', sepError);
      throw sepError;
    }
    const separatedIds = new Set((sepData ?? []).map((r) => r.invoice_id));
    for (const row of detail) row.ivaSeparated = separatedIds.has(row.id);
  }

  // Comparativo: los 6 meses de la ventana en orden ascendente (meses sin
  // facturas aparecen en cero, para que el gráfico no tenga huecos).
  const comparison: IvaF29MonthSummary[] = [];
  for (let i = COMPARISON_MONTHS - 1; i >= 0; i--) {
    const m = addMonths(period, -i);
    comparison.push(byMonth.get(m) ?? emptySummary(m));
  }

  const summary = byMonth.get(period) ?? emptySummary(period);

  return { period, summary, invoices: detail, comparison };
}

/** Hook del tab IVA (F29). `period` en formato 'YYYY-MM'. */
export function useIvaF29Fetcher(period: string) {
  return useQuery({
    queryKey: ['iva-f29', period],
    enabled: !!period,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchIvaF29(period),
  });
}
