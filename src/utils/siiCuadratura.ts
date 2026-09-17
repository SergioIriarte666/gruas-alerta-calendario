/**
 * Cuadratura SII: lógica pura de match entre el RCV de ventas (sii_rcv_records)
 * y las facturas del TMS (invoices), por folio SII = numero_fiscal.
 *
 * Reglas de negocio:
 * - El match es SIEMPRE por folio del documento; nunca se agrupa por RUT
 *   (departamentos del mismo RUT son unidades separadas).
 * - Las notas de crédito (doc_type 61) no son descuadre: se listan aparte,
 *   asociadas al folio que referencian (ref_folio) cuando el CSV lo trae.
 * - Reporte de solo lectura: esta capa no escribe nada.
 */
import { DOC_TYPE_NOTA_CREDITO } from '@/types/siiRcv';

export type CuadraturaRcvInput = {
  id: string;
  doc_type: number;
  folio: number;
  counterpart_rut: string;
  counterpart_name: string | null;
  doc_date: string;
  total_amount: number;
  ref_doc_type: number | null;
  ref_folio: number | null;
};

export type CuadraturaInvoiceInput = {
  id: string;
  folio: string;
  numero_fiscal: string | null;
  issue_date: string;
  total: number | null;
  status: string | null;
  clientName: string | null;
};

export type CuadraturaInvoiceRef = {
  id: string;
  folio: string;
  numeroFiscal: string | null;
  issueDate: string;
  total: number;
  status: string;
  clientName: string | null;
};

export type CuadraturaMatchCategoria = 'ok' | 'monto_no_cuadra' | 'sii_sin_tms';

export type CuadraturaMatchRow = {
  rcvId: string;
  docType: number;
  folio: number;
  docDate: string;
  counterpartRut: string;
  counterpartName: string | null;
  siiTotal: number;
  invoice: CuadraturaInvoiceRef | null;
  /** siiTotal - invoice.total (solo cuando hay match). */
  diff: number | null;
  categoria: CuadraturaMatchCategoria;
};

export type CuadraturaNotaCreditoRow = {
  rcvId: string;
  folio: number;
  docDate: string;
  counterpartRut: string;
  counterpartName: string | null;
  siiTotal: number;
  refDocType: number | null;
  refFolio: number | null;
  /** Factura del TMS cuyo numero_fiscal coincide con ref_folio, si existe. */
  refInvoice: CuadraturaInvoiceRef | null;
};

export type SiiCuadraturaSummary = {
  ok: { count: number; total: number };
  montoNoCuadra: { count: number; siiTotal: number; tmsTotal: number; diff: number };
  siiSinTms: { count: number; total: number };
  tmsSinSii: { count: number; total: number };
  notasCredito: { count: number; total: number };
};

export type SiiCuadraturaResult = {
  period: string;
  rows: CuadraturaMatchRow[];
  tmsSinSii: CuadraturaInvoiceRef[];
  notasCredito: CuadraturaNotaCreditoRow[];
  summary: SiiCuadraturaSummary;
  /** Facturas vigentes del período sin numero_fiscal (no cuadrables, informativo). */
  sinNumeroFiscal: number;
};

/**
 * Normaliza un numero_fiscal (texto libre) a folio comparable: solo dígitos,
 * sin ceros a la izquierda. Devuelve null si no queda ningún dígito.
 */
export const normalizeFiscalFolio = (raw: string | null | undefined): string | null => {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digits || null;
};

export const docTypeLabel = (docType: number): string => {
  switch (docType) {
    case 33: return 'Factura electrónica';
    case 34: return 'Factura exenta';
    case 39: return 'Boleta electrónica';
    case 56: return 'Nota de débito';
    case 61: return 'Nota de crédito';
    default: return `DTE tipo ${docType}`;
  }
};

const toInvoiceRef = (invoice: CuadraturaInvoiceInput): CuadraturaInvoiceRef => ({
  id: invoice.id,
  folio: invoice.folio,
  numeroFiscal: invoice.numero_fiscal,
  issueDate: invoice.issue_date,
  total: Math.round(Number(invoice.total || 0)),
  status: invoice.status ?? 'draft',
  clientName: invoice.clientName,
});

export function computeSiiCuadratura(params: {
  period: string;
  rcvRows: CuadraturaRcvInput[];
  /** Facturas emitidas en el período (para TMS SIN SII); pueden incluir anuladas. */
  periodInvoices: CuadraturaInvoiceInput[];
  /** Facturas encontradas por folio fuera del período (drift de fecha). */
  extraInvoices: CuadraturaInvoiceInput[];
  /** Segundo resguardo de anulación (invoice_cancellations), como en IVA F29. */
  cancelledInvoiceIds: Set<string>;
}): SiiCuadraturaResult {
  const { period, rcvRows, periodInvoices, extraInvoices, cancelledInvoiceIds } = params;

  const isCancelled = (invoice: CuadraturaInvoiceInput): boolean =>
    invoice.status === 'cancelled' || cancelledInvoiceIds.has(invoice.id);

  // Índice folio normalizado → facturas. Ante duplicados de numero_fiscal se
  // prefiere la vigente (una anulada + su reemplazo comparten folio a veces).
  const invoicesByFolio = new Map<string, CuadraturaInvoiceInput[]>();
  for (const invoice of [...periodInvoices, ...extraInvoices]) {
    const key = normalizeFiscalFolio(invoice.numero_fiscal);
    if (!key) continue;
    const list = invoicesByFolio.get(key) ?? [];
    if (!list.some((existing) => existing.id === invoice.id)) list.push(invoice);
    invoicesByFolio.set(key, list);
  }
  const findInvoice = (folio: number): CuadraturaInvoiceInput | null => {
    const list = invoicesByFolio.get(String(folio)) ?? [];
    if (list.length === 0) return null;
    return list.find((invoice) => !isCancelled(invoice)) ?? list[0];
  };

  const documentos = rcvRows.filter((row) => row.doc_type !== DOC_TYPE_NOTA_CREDITO);
  const ncs = rcvRows.filter((row) => row.doc_type === DOC_TYPE_NOTA_CREDITO);

  const rows: CuadraturaMatchRow[] = documentos.map((row) => {
    const siiTotal = Math.round(Number(row.total_amount || 0));
    const invoice = findInvoice(row.folio);
    if (!invoice) {
      return {
        rcvId: row.id,
        docType: row.doc_type,
        folio: row.folio,
        docDate: row.doc_date,
        counterpartRut: row.counterpart_rut,
        counterpartName: row.counterpart_name,
        siiTotal,
        invoice: null,
        diff: null,
        categoria: 'sii_sin_tms' as const,
      };
    }
    const ref = toInvoiceRef(invoice);
    const diff = siiTotal - ref.total;
    return {
      rcvId: row.id,
      docType: row.doc_type,
      folio: row.folio,
      docDate: row.doc_date,
      counterpartRut: row.counterpart_rut,
      counterpartName: row.counterpart_name,
      siiTotal,
      invoice: ref,
      diff,
      categoria: diff === 0 ? ('ok' as const) : ('monto_no_cuadra' as const),
    };
  });

  const notasCredito: CuadraturaNotaCreditoRow[] = ncs.map((row) => {
    const refInvoice = row.ref_folio != null ? findInvoice(row.ref_folio) : null;
    return {
      rcvId: row.id,
      folio: row.folio,
      docDate: row.doc_date,
      counterpartRut: row.counterpart_rut,
      counterpartName: row.counterpart_name,
      siiTotal: Math.round(Number(row.total_amount || 0)),
      refDocType: row.ref_doc_type,
      refFolio: row.ref_folio,
      refInvoice: refInvoice ? toInvoiceRef(refInvoice) : null,
    };
  });

  // TMS SIN SII: facturas del período con numero_fiscal, vigentes, cuyo folio
  // no aparece en el RCV. Las sin numero_fiscal no son cuadrables (informativo).
  const rcvFolioSet = new Set(documentos.map((row) => String(row.folio)));
  const tmsSinSii: CuadraturaInvoiceRef[] = [];
  let sinNumeroFiscal = 0;
  for (const invoice of periodInvoices) {
    if (isCancelled(invoice)) continue;
    const key = normalizeFiscalFolio(invoice.numero_fiscal);
    if (!key) {
      sinNumeroFiscal += 1;
      continue;
    }
    if (!rcvFolioSet.has(key)) tmsSinSii.push(toInvoiceRef(invoice));
  }

  const okRows = rows.filter((row) => row.categoria === 'ok');
  const noCuadraRows = rows.filter((row) => row.categoria === 'monto_no_cuadra');
  const siiSinTmsRows = rows.filter((row) => row.categoria === 'sii_sin_tms');

  const summary: SiiCuadraturaSummary = {
    ok: {
      count: okRows.length,
      total: okRows.reduce((sum, row) => sum + row.siiTotal, 0),
    },
    montoNoCuadra: {
      count: noCuadraRows.length,
      siiTotal: noCuadraRows.reduce((sum, row) => sum + row.siiTotal, 0),
      tmsTotal: noCuadraRows.reduce((sum, row) => sum + (row.invoice?.total ?? 0), 0),
      diff: noCuadraRows.reduce((sum, row) => sum + (row.diff ?? 0), 0),
    },
    siiSinTms: {
      count: siiSinTmsRows.length,
      total: siiSinTmsRows.reduce((sum, row) => sum + row.siiTotal, 0),
    },
    tmsSinSii: {
      count: tmsSinSii.length,
      total: tmsSinSii.reduce((sum, invoice) => sum + invoice.total, 0),
    },
    notasCredito: {
      count: notasCredito.length,
      total: notasCredito.reduce((sum, nc) => sum + nc.siiTotal, 0),
    },
  };

  return { period, rows, tmsSinSii, notasCredito, summary, sinNumeroFiscal };
}
