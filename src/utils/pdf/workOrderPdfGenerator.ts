import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Service } from '@/types';
import { Settings } from '@/types/settings';
import { addCompanyHeader } from '@/utils/reports/reportUtils';
import { getCraneTypeLabel } from '@/utils/craneType';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { formatVehicleInfo, shouldShowVehicleInfo } from '@/utils/statusHelpers';
import { toTitleCase } from '@/lib/utils';

const VIOLET: [number, number, number] = [139, 92, 246];
const MUTED: [number, number, number] = [100, 100, 100];

/**
 * Genera una Orden de Trabajo para terreno (sin información financiera interna).
 * Tipografía grande, claro, con cuadros de firma al pie.
 */
export const generateWorkOrderPDF = async (
  service: Service,
  settings: Settings,
): Promise<{ blob: Blob; fileName: string }> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;

  let y = await addCompanyHeader(doc, settings.company, 15);

  // Título
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...VIOLET);
  doc.text('ORDEN DE TRABAJO', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');

  // Folio destacado
  doc.setFillColor(...VIOLET);
  doc.rect(marginX, y, contentWidth, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`FOLIO: ${service.folio}`, marginX + 4, y + 9.5);
  // Fecha + hora a la derecha
  doc.setFontSize(11);
  const dateStr = service.serviceDate ? formatForDisplay(service.serviceDate) : '—';
  const timeStr = service.startTime || '';
  doc.text(`${dateStr}${timeStr ? '  ' + timeStr : ''}`, pageWidth - marginX - 4, y + 9.5, {
    align: 'right',
  });
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  y += 18;

  // Cliente
  const clientRows: [string, string][] = [
    ['Razón Social', toTitleCase(service.client?.name || '—')],
    ['RUT', service.client?.rut || '—'],
    ['Teléfono', service.client?.phone || '—'],
  ];
  if (service.client?.contactName) clientRows.push(['Contacto', service.client.contactName]);
  if (service.insuredName) clientRows.push(['Asegurado', toTitleCase(service.insuredName)]);
  if (service.purchaseOrder || service.purchaseOrderNumber)
    clientRows.push(['Orden de Compra', service.purchaseOrderNumber || service.purchaseOrder || '—']);

  autoTable(doc, {
    startY: y,
    head: [['Cliente', '']],
    body: clientRows,
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 11 },
    styles: { fontSize: 11, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: 60 },
      1: { cellWidth: contentWidth - 50 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // Vehículo
  autoTable(doc, {
    startY: y,
    head: [['Vehículo a Asistir', '']],
    body: [
      ['Vehículo', formatVehicleInfo(service)],
      ['Patente', shouldShowVehicleInfo(service) ? service.licensePlate || '—' : '—'],
    ],
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 11 },
    styles: { fontSize: 11, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: 60 },
      1: { cellWidth: contentWidth - 50 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // Ruta
  autoTable(doc, {
    startY: y,
    head: [['Ruta', '']],
    body: [
      ['Origen', service.origin || '—'],
      ['Destino', service.destination || '—'],
      ['Tipo de Servicio', service.serviceType?.name || '—'],
    ],
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 11 },
    styles: { fontSize: 11, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: 60 },
      1: { cellWidth: contentWidth - 50 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // Asignación
  const assignRows: [string, string][] = [];
  if (service.crane)
    assignRows.push([
      'Grúa',
      `${service.crane.licensePlate || ''} · ${service.crane.brand || ''} ${service.crane.model || ''} · ${getCraneTypeLabel(service.crane.type)}`,
    ]);
  if (service.operator)
    assignRows.push(['Operador', toTitleCase(service.operator.name || '—')]);

  if (assignRows.length) {
    autoTable(doc, {
      startY: y,
      head: [['Asignación', '']],
      body: assignRows,
      theme: 'grid',
      headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 11 },
      styles: { fontSize: 11, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, textColor: 60 },
        1: { cellWidth: contentWidth - 50 },
      },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // Observaciones / instrucciones (cuadro grande)
  autoTable(doc, {
    startY: y,
    head: [['Instrucciones / Observaciones']],
    body: [[service.observations || ' ']],
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 11 },
    styles: { fontSize: 10, cellPadding: 4, minCellHeight: 28 },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Firmas
  const sigY = Math.max(y, pageHeight - 50);
  const colW = (contentWidth - 10) / 2;
  doc.setDrawColor(180);
  doc.rect(marginX, sigY, colW, 28);
  doc.rect(marginX + colW + 10, sigY, colW, 28);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('Firma Operador', marginX + colW / 2, sigY + 33, { align: 'center' });
  doc.text('Firma Cliente / Recepción', marginX + colW + 10 + colW / 2, sigY + 33, {
    align: 'center',
  });
  doc.setTextColor(0, 0, 0);

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Documento de uso interno operacional', marginX, ph - 7);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, ph - 7, { align: 'right' });
  }

  return {
    blob: doc.output('blob'),
    fileName: `orden-trabajo-${service.folio}.pdf`,
  };
};
