import { docTypeLabel, type SiiCuadraturaResult } from '@/utils/siiCuadratura';

const statusLabel = (status: string): string => {
  const map: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    paid: 'Pagada',
    partial: 'Parcial',
    overdue: 'Vencida',
    cancelled: 'Anulada',
  };
  return map[status] || status;
};

/**
 * Exporta la cuadratura SII vs TMS a Excel: hoja de resumen + una hoja por
 * categoría + notas de crédito. Solo lectura, no toca la base.
 */
export async function exportSiiCuadraturaExcel(result: SiiCuadraturaResult) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const { summary } = result;

  const resumen = [
    ['Cuadratura Libro de Ventas SII vs Facturas TMS'],
    ['Entidad', 'Grúas 5 Norte SpA (76.769.841-0)'],
    ['Período', result.period],
    [],
    ['Categoría', 'Documentos', 'Monto'],
    ['OK (folio y monto cuadran)', summary.ok.count, summary.ok.total],
    ['Monto no cuadra', summary.montoNoCuadra.count, summary.montoNoCuadra.siiTotal],
    ['SII sin TMS', summary.siiSinTms.count, summary.siiSinTms.total],
    ['TMS sin SII', summary.tmsSinSii.count, summary.tmsSinSii.total],
    ['Notas de crédito (informativo)', summary.notasCredito.count, summary.notasCredito.total],
    [],
    ['Diferencia acumulada en "Monto no cuadra" (SII - TMS)', '', summary.montoNoCuadra.diff],
    ['Facturas del período sin N° fiscal (no cuadrables)', result.sinNumeroFiscal, ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');

  const matchSheet = (categoria: 'ok' | 'monto_no_cuadra' | 'sii_sin_tms') =>
    result.rows
      .filter((row) => row.categoria === categoria)
      .map((row) => ({
        'Folio SII': row.folio,
        'Tipo DTE': docTypeLabel(row.docType),
        'Fecha SII': row.docDate,
        'RUT Cliente': row.counterpartRut,
        'Razón Social': row.counterpartName ?? '',
        'Total SII': row.siiTotal,
        'Folio TMS': row.invoice?.folio ?? '',
        'N° Fiscal TMS': row.invoice?.numeroFiscal ?? '',
        'Fecha TMS': row.invoice?.issueDate ?? '',
        'Total TMS': row.invoice?.total ?? '',
        'Diferencia (SII - TMS)': row.diff ?? '',
        'Estado TMS': row.invoice ? statusLabel(row.invoice.status) : '',
      }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchSheet('monto_no_cuadra')), 'Monto no cuadra');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchSheet('sii_sin_tms')), 'SII sin TMS');

  const tmsSinSii = result.tmsSinSii.map((invoice) => ({
    'Folio TMS': invoice.folio,
    'N° Fiscal': invoice.numeroFiscal ?? '',
    'Cliente': invoice.clientName ?? '',
    'Fecha Emisión': invoice.issueDate,
    'Total TMS': invoice.total,
    'Estado': statusLabel(invoice.status),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tmsSinSii), 'TMS sin SII');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchSheet('ok')), 'OK');

  const ncs = result.notasCredito.map((nc) => ({
    'Folio NC': nc.folio,
    'Fecha': nc.docDate,
    'RUT Cliente': nc.counterpartRut,
    'Razón Social': nc.counterpartName ?? '',
    'Monto NC': nc.siiTotal,
    'Folio Referenciado': nc.refFolio ?? '',
    'Factura TMS': nc.refInvoice?.folio ?? '',
    'Cliente TMS': nc.refInvoice?.clientName ?? '',
    'Estado Factura': nc.refInvoice ? statusLabel(nc.refInvoice.status) : '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ncs), 'Notas de crédito');

  XLSX.writeFile(wb, `cuadratura-sii-${result.period}.xlsx`);
}
