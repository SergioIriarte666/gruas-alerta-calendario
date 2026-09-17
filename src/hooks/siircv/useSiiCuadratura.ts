import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { normalizeRut } from '@/utils/rutFormatter';
import { addMonths, monthStart } from '@/utils/ivaF29Utils';
import {
  computeSiiCuadratura,
  type CuadraturaInvoiceInput,
  type CuadraturaRcvInput,
  type SiiCuadraturaResult,
} from '@/utils/siiCuadratura';

const logger = createLogger('SiiCuadratura');

/** Entidad de la cuadratura: Grúas 5 Norte SpA (las facturas del TMS son de G5N). */
export const G5N_ENTITY_RUT = normalizeRut('76769841-0');

const INVOICE_SELECT = `id, folio, numero_fiscal, issue_date, total, status,
  client:clients!invoices_client_id_fkey ( name )`;

type RawInvoice = {
  id: string;
  folio: string;
  numero_fiscal: string | null;
  issue_date: string;
  total: number | null;
  status: string | null;
  client: { name: string | null } | null;
};

const toInput = (row: RawInvoice): CuadraturaInvoiceInput => ({
  id: row.id,
  folio: row.folio,
  numero_fiscal: row.numero_fiscal,
  issue_date: row.issue_date,
  total: row.total,
  status: row.status,
  clientName: row.client?.name ?? null,
});

const IN_CHUNK = 200;

/**
 * Cuadratura del libro de VENTAS del SII contra las facturas del TMS.
 * Solo lectura: no modifica facturas ni estados.
 */
async function fetchSiiCuadratura(period: string): Promise<SiiCuadraturaResult> {
  const start = monthStart(period);
  const end = monthStart(addMonths(period, 1));

  // 1) RCV de ventas de G5N del período.
  const { data: rcvData, error: rcvError } = await supabase
    .from('sii_rcv_records')
    .select('id, doc_type, folio, counterpart_rut, counterpart_name, doc_date, total_amount, ref_doc_type, ref_folio')
    .eq('entity_rut', G5N_ENTITY_RUT)
    .eq('book_type', 'venta')
    .gte('doc_date', start)
    .lt('doc_date', end)
    .order('folio', { ascending: true })
    .range(0, 4999);
  if (rcvError) {
    logger.error('Error obteniendo RCV de ventas para cuadratura', rcvError);
    throw rcvError;
  }
  const rcvRows = (rcvData ?? []) as CuadraturaRcvInput[];

  // 2) Facturas emitidas en el período (incluye anuladas: se filtran en la
  //    lógica pura, pero una anulada igual puede matchear un folio del RCV).
  //    Las HIST-% quedan fuera: son importación histórica sin numero_fiscal confiable.
  const { data: periodData, error: periodError } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .gte('issue_date', start)
    .lt('issue_date', end)
    .not('folio', 'like', 'HIST-%')
    .range(0, 4999);
  if (periodError) {
    logger.error('Error obteniendo facturas del período para cuadratura', periodError);
    throw periodError;
  }
  const periodInvoices = ((periodData ?? []) as RawInvoice[]).map(toInput);

  // 3) Folios del RCV sin factura en el período: buscarlos sin filtro de fecha
  //    (una factura registrada en otro mes es justamente el drift a detectar).
  const periodFolios = new Set(
    periodInvoices
      .map((invoice) => (invoice.numero_fiscal ?? '').replace(/\D/g, '').replace(/^0+/, ''))
      .filter(Boolean),
  );
  const missingFolios = Array.from(new Set(
    rcvRows
      .flatMap((row) => [row.folio, row.ref_folio])
      .filter((folio): folio is number => folio != null && folio > 0)
      .map(String),
  )).filter((folio) => !periodFolios.has(folio));

  const extraInvoices: CuadraturaInvoiceInput[] = [];
  for (let i = 0; i < missingFolios.length; i += IN_CHUNK) {
    const chunk = missingFolios.slice(i, i + IN_CHUNK);
    const { data: extraData, error: extraError } = await supabase
      .from('invoices')
      .select(INVOICE_SELECT)
      .in('numero_fiscal', chunk)
      .not('folio', 'like', 'HIST-%')
      .range(0, 4999);
    if (extraError) {
      logger.error('Error buscando facturas por folio SII', extraError);
      throw extraError;
    }
    extraInvoices.push(...((extraData ?? []) as RawInvoice[]).map(toInput));
  }

  // 4) Segundo resguardo de anulación, igual que en IVA F29.
  const { data: cancelledRows, error: cancelledError } = await supabase
    .from('invoice_cancellations')
    .select('invoice_id');
  if (cancelledError) {
    logger.error('Error obteniendo anulaciones para cuadratura', cancelledError);
    throw cancelledError;
  }
  const cancelledInvoiceIds = new Set((cancelledRows ?? []).map((row) => row.invoice_id));

  return computeSiiCuadratura({ period, rcvRows, periodInvoices, extraInvoices, cancelledInvoiceIds });
}

/**
 * Hook del tab "Cuadratura SII". `period` en formato 'YYYY-MM'.
 * La queryKey cuelga de ['sii-rcv'] para que una importación RCV la invalide.
 */
export function useSiiCuadratura(period: string) {
  return useQuery({
    queryKey: ['sii-rcv', 'cuadratura', period],
    enabled: !!period,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchSiiCuadratura(period),
  });
}
