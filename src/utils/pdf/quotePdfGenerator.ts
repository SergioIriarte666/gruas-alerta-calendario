import { businessClock } from '@/utils/businessClock';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Service } from '@/types';
import { Settings } from '@/types/settings';
import { addCompanyHeader } from '@/utils/reports/reportUtils';
import { getCraneTypeLabel } from '@/utils/craneType';
import { formatForDisplay, safeParseDateOnly } from '@/utils/timezoneUtils';
import { formatVehicleInfo, shouldShowVehicleInfo } from '@/utils/statusHelpers';
import { toTitleCase } from '@/lib/utils';

const VIOLET: [number, number, number] = [139, 92, 246];
const MUTED: [number, number, number] = [100, 100, 100];

const formatCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(Math.round(n || 0));

const addDaysISO = (iso: string, days: number) => {
  const d = safeParseDateOnly(iso);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Genera un PDF de Cotización / Presupuesto para un servicio.
 * Sigue el patrón visual del módulo de Costos (violet brand color).
 */
export const generateQuotePDF = async (
  service: Service,
  settings: Settings,
): Promise<{ blob: Blob; fileName: string }> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;

  // Header corporativo (mismo patrón que costDetailPdfGenerator)
  let y = await addCompanyHeader(doc, settings.company, 15);

  // Título
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...VIOLET);
  doc.text('COTIZACIÓN / PRESUPUESTO', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setDrawColor(...VIOLET);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');

  const today = businessClock.today();
  const quoteNumber = service.quoteNumber || `COT-${service.folio}`;
  const validUntil = addDaysISO(today, 15);

  // Bloque cabecera del documento
  autoTable(doc, {
    startY: y,
    body: [
      ['N° Cotización', quoteNumber, 'Fecha emisión', formatForDisplay(today)],
      ['Folio servicio', service.folio, 'Válida hasta', formatForDisplay(validUntil)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, textColor: 60, fillColor: [245, 245, 245] },
      1: { cellWidth: contentWidth / 2 - 35 },
      2: { fontStyle: 'bold', cellWidth: 35, textColor: 60, fillColor: [245, 245, 245] },
      3: { cellWidth: contentWidth / 2 - 35 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Cliente
  const clientRows: [string, string][] = [
    ['Razón Social', toTitleCase(service.client?.name || '—')],
    ['RUT', service.client?.rut || '—'],
    ['Dirección', service.client?.address || '—'],
    ['Teléfono', service.client?.phone || '—'],
    ['Email', service.client?.email || '—'],
  ];
  if (service.client?.contactName) clientRows.push(['Contacto', service.client.contactName]);
  if (service.purchaseOrder || service.purchaseOrderNumber)
    clientRows.push(['Orden de Compra', service.purchaseOrderNumber || service.purchaseOrder || '—']);

  autoTable(doc, {
    startY: y,
    head: [['Cliente', '']],
    body: clientRows,
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: 60 },
      1: { cellWidth: contentWidth - 45 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Detalle del servicio
  const serviceRows: [string, string][] = [
    ['Tipo de Servicio', service.serviceType?.name || '—'],
    ['Vehículo', formatVehicleInfo(service)],
    ['Patente', shouldShowVehicleInfo(service) ? service.licensePlate || '—' : '—'],
    ['Origen', service.origin || '—'],
    ['Destino', service.destination || '—'],
    ['Fecha estimada', service.serviceDate ? formatForDisplay(service.serviceDate) : '—'],
  ];
  if (service.crane)
    serviceRows.push([
      'Grúa asignada',
      `${service.crane.licensePlate || ''} - ${getCraneTypeLabel(service.crane.type)}`.trim(),
    ]);
  if (service.observations) serviceRows.push(['Observaciones', service.observations]);

  autoTable(doc, {
    startY: y,
    head: [['Detalle del Servicio', '']],
    body: serviceRows,
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: 60 },
      1: { cellWidth: contentWidth - 45 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Custodia (si aplica)
  const custodyTotal = Number(service.custodyTotalAmount || 0);
  if (service.custodyMode && service.custodyMode !== 'none' && custodyTotal > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Custodia', '']],
      body: [
        ['Días', String(service.custodyDays ?? '—')],
        ['Tarifa diaria', formatCLP(Number(service.custodyDailyRate || 0))],
        ['Total custodia', formatCLP(custodyTotal)],
      ],
      theme: 'grid',
      headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45, textColor: 60 },
        1: { cellWidth: contentWidth - 45 },
      },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Tabla de valores (totales)
  const serviceBase = Number(service.value || 0);
  const excess = service.hasExcess ? Number(service.excessAmount || 0) : 0;
  const subtotalNet = serviceBase + custodyTotal + excess;
  const iva = Math.round(subtotalNet * 0.19);
  const total = subtotalNet + iva;

  const valueRows: [string, string][] = [
    ['Servicio base', formatCLP(serviceBase)],
  ];
  if (custodyTotal > 0) valueRows.push(['Custodia', formatCLP(custodyTotal)]);
  if (excess > 0) valueRows.push(['Exceso', formatCLP(excess)]);
  valueRows.push(['Subtotal neto', formatCLP(subtotalNet)]);
  valueRows.push(['IVA (19%)', formatCLP(iva)]);

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Monto']],
    body: valueRows,
    foot: [['TOTAL A PAGAR', formatCLP(total)]],
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 11 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: contentWidth - 60, textColor: 60 },
      1: { cellWidth: 60, halign: 'right' },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Condiciones
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const conditions = doc.splitTextToSize(
    'Precios expresados en pesos chilenos (CLP). IVA incluido en el total. ' +
      `Cotización válida hasta el ${formatForDisplay(validUntil)}.`,
    contentWidth,
  );
  doc.text(conditions, marginX, y);
  y += conditions.length * 4 + 4;

  // Footer en cada página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.height;
    doc.setDrawColor(220);
    doc.line(marginX, ph - 14, pageWidth - marginX, ph - 14);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Este documento es una cotización y no constituye factura.', marginX, ph - 9);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, ph - 9, { align: 'right' });
  }

  return {
    blob: doc.output('blob'),
    fileName: `cotizacion-${service.folio}.pdf`,
  };
};
