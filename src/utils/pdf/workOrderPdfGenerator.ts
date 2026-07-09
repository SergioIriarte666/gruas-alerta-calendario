import jsPDF from 'jspdf';
import { type Service } from '@/types';
import { type Settings } from '@/types/settings';
import { fetchServiceItemsBreakdown } from './serviceItemsData';
import {
  PDF_COLORS,
  addFooter,
  addLetterhead,
  addLineItemsTable,
  addSectionTable,
  addSummaryTable,
  buildCraneLabel,
  buildFinancialSummary,
  buildVehicleLabel,
  fetchCommercialDocumentContext,
  formatDocumentCurrency,
  formatDocumentDateTime,
  formatText,
  resolvePrimaryOperator,
} from './commercialPdfShared';

const addSignatureBlock = (doc: jsPDF, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const baseY = Math.max(startY + 8, pageHeight - 62);
  const columnWidth = 78;
  const leftX = 16;
  const rightX = pageWidth - 16 - columnWidth;

  [leftX, rightX].forEach((x) => {
    doc.setDrawColor(...PDF_COLORS.line);
    doc.line(x, baseY, x + columnWidth, baseY);
    doc.line(x, baseY + 14, x + columnWidth, baseY + 14);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text('Recibido conforme por', leftX, baseY - 3);
  doc.text('Ejecutado por', rightX, baseY - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.slate);
  doc.text('Nombre y firma', leftX, baseY + 4.5);
  doc.text('RUT', leftX, baseY + 18.5);
  doc.text('Nombre y firma', rightX, baseY + 4.5);
  doc.text('RUT', rightX, baseY + 18.5);
};

export const generateWorkOrderPDF = async (
  service: Service,
  settings: Settings,
): Promise<{ blob: Blob; fileName: string }> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const context = await fetchCommercialDocumentContext(settings);
  const primaryOperator = resolvePrimaryOperator(service);

  let y = await addLetterhead(doc, context, {
    title: 'ORDEN DE TRABAJO',
    documentNumber: formatText(service.folio),
    secondaryLine: formatDocumentDateTime(service.serviceDate, service.startTime),
  });

  const clientRows: Array<[string, string]> = [
    ['Cliente', formatText(service.client?.name)],
    ['RUT', formatText(service.client?.rut)],
    ['Contacto', formatText(service.contactPerson || service.client?.contactName)],
    ['Telefono', formatText(service.contactPhone || service.client?.phone)],
  ];

  if (service.purchaseOrderNumber || service.purchaseOrder) {
    clientRows.push(['Orden de compra', formatText(service.purchaseOrderNumber || service.purchaseOrder)]);
  }

  y = addSectionTable(doc, y, 'Datos del Cliente', clientRows);

  const operationalRows: Array<[string, string]> = [
    ['Tipo de servicio', formatText(service.serviceType?.name)],
    ['Fecha / hora', formatDocumentDateTime(service.serviceDate, service.startTime)],
    ['Ubicacion / faena', formatText(service.origin)],
    ['Destino / entrega', formatText(service.destination)],
    ['Grua asignada', buildCraneLabel(service)],
    ['Operador', formatText(primaryOperator?.name)],
    ['Vehiculo / equipo', buildVehicleLabel(service)],
  ];

  y = addSectionTable(doc, y, 'Datos Operativos', operationalRows);

  const breakdown = await fetchServiceItemsBreakdown(service.id);
  const lineRows = breakdown?.items.length
    ? breakdown.items.map((item) => [
        formatText(item.glosa),
        String(Number(item.cantidad || 0)),
        formatDocumentCurrency(Number(item.valor_unitario || 0)),
        formatDocumentCurrency(Number(item.cantidad || 0) * Number(item.valor_unitario || 0)),
      ])
    : [[
        formatText(service.serviceType?.name || 'Servicio'),
        '1',
        formatDocumentCurrency(Number(service.value || 0)),
        formatDocumentCurrency(Number(service.value || 0)),
      ]];

  const serviceNetAmount = breakdown?.subtotal ?? Number(service.value || 0);
  y = addLineItemsTable(doc, y + 2, 'Desglose Operativo', lineRows, [
    ['', '', 'Subtotal neto', formatDocumentCurrency(serviceNetAmount)],
  ]);

  const totals = buildFinancialSummary(service, serviceNetAmount);
  y = addSummaryTable(doc, y, 'Resumen Referencial', [
    ['Subtotal servicio', formatDocumentCurrency(totals.serviceNet)],
    ...(totals.custodyNet > 0 ? [['Custodia', formatDocumentCurrency(totals.custodyNet)] as [string, string]] : []),
    ...(totals.excessNet > 0 ? [['Excedente', formatDocumentCurrency(totals.excessNet)] as [string, string]] : []),
    ['Total neto referencial', formatDocumentCurrency(totals.subtotalNet)],
  ]);

  y = addSectionTable(doc, y, 'Observaciones del Servicio', [
    ['Detalle', formatText(service.observations || 'Sin observaciones registradas.')],
  ]);

  addSignatureBlock(doc, y);
  addFooter(doc, 'Documento operativo interno. Valores expresados como referencia neta.');

  return {
    blob: doc.output('blob'),
    fileName: `OrdenTrabajo_${service.folio}.pdf`,
  };
};
