import { DisputeReportRow } from '@/hooks/reports/useDisputesReport';
import { createExportFileName } from './reportUtils';
import { DISPUTE_TYPE_LABELS } from '@/utils/serviceDisputeUtils';
import { safeDateToDisplaySlashes } from '@/utils/timezoneUtils';

export const exportDisputesReport = async (
  rows: DisputeReportRow[],
  filters: { dateFrom: string; dateTo: string }
) => {
  const XLSX = await import('xlsx');

  const data = rows.map(row => ({
    'Folio Servicio': row.serviceFolio,
    'Cliente': row.clientName,
    'Tipo de Disputa': DISPUTE_TYPE_LABELS[row.disputeType],
    'Descripción': row.description,
    'Referencia': row.referenceDoc || '',
    'Monto en Disputa': row.disputedAmount ?? row.serviceValue,
    'Estado': row.status === 'open' ? 'Abierta' : 'Resuelta',
    'Fecha Creación': safeDateToDisplaySlashes(row.createdAt.slice(0, 10)),
    'Fecha Resolución': row.resolvedAt ? safeDateToDisplaySlashes(row.resolvedAt.slice(0, 10)) : '',
    'Marcada Por': row.createdByName || '',
    'Resuelta Por': row.resolvedByName || '',
    'Notas de Resolución': row.resolutionNotes || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Servicios en Disputa');

  const fileName = createExportFileName('disputas', filters.dateFrom, filters.dateTo);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
