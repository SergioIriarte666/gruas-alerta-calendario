import jsPDF from 'jspdf';
import { type Service } from '@/types';
import { type Settings } from '@/types/settings';
import { businessClock } from '@/utils/businessClock';
import { fetchServiceItemsBreakdown } from './serviceItemsData';
import {
  QUOTE_VALIDITY_DAYS,
  DEFAULT_COMMERCIAL_TERMS,
  addDaysToBusinessDate,
  addFooter,
  addLetterhead,
  addLineItemsTable,
  addSectionTable,
  addSummaryTable,
  buildCraneLabel,
  buildFinancialSummary,
  fetchCommercialDocumentContext,
  formatDocumentCurrency,
  formatDocumentDate,
  formatDocumentDateTime,
  formatText,
  resolvePrimaryOperator,
} from './commercialPdfShared';

export const generateQuotePDF = async (
  service: Service,
  settings: Settings,
): Promise<{ blob: Blob; fileName: string }> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const context = await fetchCommercialDocumentContext(settings);
  const validUntilIso = addDaysToBusinessDate(businessClock.today(), QUOTE_VALIDITY_DAYS);
  const primaryOperator = resolvePrimaryOperator(service);

  let y = await addLetterhead(doc, context, {
    title: 'COTIZACION',
    documentNumber: `${formatText(service.folio)}${service.quoteNumber ? ` · ${service.quoteNumber}` : ''}`,
    secondaryLine: `Valida hasta ${formatDocumentDate(validUntilIso)}`,
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

  const descriptionRows: Array<[string, string]> = [
    ['Tipo de servicio', formatText(service.serviceType?.name)],
    ['Fecha programada', formatDocumentDateTime(service.serviceDate, service.startTime)],
    ['Vehiculo / equipo', formatText(service.vehicleBrand || service.vehicleModel || service.licensePlate ? `${service.vehicleBrand} ${service.vehicleModel}`.trim() || service.licensePlate : '-')],
    ['Origen / faena', formatText(service.origin)],
    ['Destino', formatText(service.destination)],
    ['Grua asignada', buildCraneLabel(service)],
    ['Operador asignado', formatText(primaryOperator?.name)],
  ];

  y = addSectionTable(doc, y, 'Descripcion del Servicio', descriptionRows);

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
  y = addLineItemsTable(doc, y + 2, 'Desglose', lineRows, [
    ['', '', 'Subtotal servicio', formatDocumentCurrency(serviceNetAmount)],
  ]);

  const totals = buildFinancialSummary(service, serviceNetAmount);
  const summaryRows = [
    ['Subtotal servicio', formatDocumentCurrency(totals.serviceNet)],
    ...(totals.custodyNet > 0 ? [['Custodia', formatDocumentCurrency(totals.custodyNet)] as [string, string]] : []),
    ...(totals.excessNet > 0 ? [['Excedente', formatDocumentCurrency(totals.excessNet)] as [string, string]] : []),
    ['Subtotal neto', formatDocumentCurrency(totals.subtotalNet)],
    ['IVA 19%', formatDocumentCurrency(totals.iva)],
  ];

  y = addSummaryTable(doc, y, 'Totales', summaryRows, [
    ['TOTAL', formatDocumentCurrency(totals.total)],
  ]);

  const termsRows: Array<[string, string]> = [
    ['Validez', `${QUOTE_VALIDITY_DAYS} dias corridos desde la emision`],
    ['Forma de pago', context.company.legalTexts || DEFAULT_COMMERCIAL_TERMS],
  ];

  if (service.observations) {
    termsRows.push(['Observaciones', formatText(service.observations)]);
  }

  y = addSectionTable(doc, y, 'Condiciones Comerciales', termsRows);

  addFooter(doc, `Documento comercial emitido por ${context.company.businessName || 'la empresa emisora'}.`);

  return {
    blob: doc.output('blob'),
    fileName: `Cotizacion_${service.folio}.pdf`,
  };
};
