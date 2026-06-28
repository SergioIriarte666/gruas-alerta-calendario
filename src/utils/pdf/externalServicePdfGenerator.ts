import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import { EVIDENCE_TYPE_LABELS } from '@/types/externalServices';
import type { ExternalClosure, ExternalEvidence } from '@/types/externalServices';
import { createLogger } from '@/lib/logger';

const logger = createLogger('externalServicePdfGenerator');

const GREEN: [number, number, number] = [0, 130, 100];
const PURPLE: [number, number, number] = [120, 60, 180];
const DARK: [number, number, number] = [20, 20, 20];
const GRAY: [number, number, number] = [110, 110, 110];

interface ExternalActaInput {
  service: {
    folio: string;
    serviceDate: string;
    clientName: string | null;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    licensePlate: string | null;
    origin: string | null;
    destination: string | null;
    outsourcedCost: number | null;
  };
  closure: ExternalClosure;
  evidences: ExternalEvidence[];
}

const formatCLP = (n: number | null): string => {
  if (!n) return 'No definido';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
};

export const generateExternalServiceActaPdf = async (input: ExternalActaInput): Promise<Blob> => {
  try {
    const { service, closure, evidences } = input;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PAGE_W = 210;
    const MARGIN = 14;

    // Header
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, PAGE_W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Gruas 5 Norte', MARGIN, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('RUT: 76.769.841-0 · Panamericana Norte Km. 841, Copiapó · +56 9 62380627', MARGIN, 19);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ACTA DE SERVICIO EXTERNO', PAGE_W - MARGIN, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Folio ${service.folio}`, PAGE_W - MARGIN, 19, { align: 'right' });

    let y = 36;

    // Badge
    doc.setFillColor(...GREEN);
    doc.roundedRect(MARGIN, y, 60, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('SERVICIO CERRADO POR ADMIN', MARGIN + 30, y + 5.4, { align: 'center' });
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Cerrado: ${formatBusinessDateLong(closure.closedAt)}`, PAGE_W - MARGIN, y + 5.4, { align: 'right' });
    y += 14;

    // Datos del servicio
    doc.setFillColor(...PURPLE);
    doc.rect(MARGIN, y, 5, 8, 'F');
    doc.setTextColor(...PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('INFORMACIÓN DEL SERVICIO', MARGIN + 9, y + 5.5);
    y += 12;

    const vehiculo = service.vehicleBrand
      ? `${service.vehicleBrand} ${service.vehicleModel ?? ''} (${service.licensePlate ?? 'S/P'})`
      : 'N/A';

    autoTable(doc, {
      startY: y,
      head: [],
      body: [
        ['Cliente', service.clientName ?? 'N/A', 'Vehículo', vehiculo],
        ['Fecha', formatBusinessDateLong(service.serviceDate), 'Origen', service.origin ?? 'N/A'],
        ['Costo subc.', formatCLP(service.outsourcedCost), 'Destino', service.destination ?? 'N/A'],
      ],
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 4, right: 4 }, textColor: DARK },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 28, textColor: GRAY },
        1: { cellWidth: 70 },
        2: { fontStyle: 'bold', cellWidth: 28, textColor: GRAY },
        3: { cellWidth: 56 },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Proveedor externo
    doc.setFillColor(...PURPLE);
    doc.rect(MARGIN, y, 5, 8, 'F');
    doc.setTextColor(...PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PROVEEDOR EXTERNO', MARGIN + 9, y + 5.5);
    y += 12;

    autoTable(doc, {
      startY: y,
      head: [],
      body: [
        ['Nombre', closure.thirdPartyProviderName],
        ['RUT', closure.thirdPartyProviderRut ?? 'No informado'],
      ],
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 4, right: 4 }, textColor: DARK },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 28, textColor: GRAY },
        1: { cellWidth: 'auto' },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Resumen del trabajo
    doc.setFillColor(...PURPLE);
    doc.rect(MARGIN, y, 5, 8, 'F');
    doc.setTextColor(...PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RESUMEN DEL TRABAJO REALIZADO', MARGIN + 9, y + 5.5);
    y += 12;

    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const summaryLines = doc.splitTextToSize(closure.thirdPartyServiceSummary, PAGE_W - MARGIN * 2);
    doc.text(summaryLines, MARGIN, y);
    y += summaryLines.length * 4.5 + 6;

    if (closure.closureNotes) {
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Observaciones del cierre:', MARGIN, y);
      y += 4.5;
      const notesLines = doc.splitTextToSize(closure.closureNotes, PAGE_W - MARGIN * 2);
      doc.text(notesLines, MARGIN, y);
      y += notesLines.length * 4 + 6;
    }

    // Evidencia adjunta (lista, sin embeber)
    if (evidences.length > 0) {
      doc.setFillColor(...PURPLE);
      doc.rect(MARGIN, y, 5, 8, 'F');
      doc.setTextColor(...PURPLE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`EVIDENCIA ADJUNTA (${evidences.length})`, MARGIN + 9, y + 5.5);
      y += 12;

      autoTable(doc, {
        startY: y,
        head: [['#', 'Tipo', 'Archivo', 'Fecha']],
        body: evidences.map((ev, i) => [
          String(i + 1),
          EVIDENCE_TYPE_LABELS[ev.evidenceType],
          ev.fileName.length > 50 ? ev.fileName.slice(0, 47) + '...' : ev.fileName,
          formatBusinessDateLong(ev.uploadedAt),
        ]),
        theme: 'grid',
        headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: DARK },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 42 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 40 },
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        margin: { left: MARGIN, right: MARGIN },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.text('La evidencia original está disponible en el sistema bajo el folio del servicio.', MARGIN, y);
      y += 8;
    }

    // Firma admin (página nueva si no cabe)
    const SIG_BLOCK_H = 50;
    if (y + SIG_BLOCK_H > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(...PURPLE);
    doc.rect(MARGIN, y, 5, 8, 'F');
    doc.setTextColor(...PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CIERRE ADMINISTRATIVO', MARGIN + 9, y + 5.5);
    y += 12;

    const sigW = 70;
    const sigH = 28;
    const sigX = (PAGE_W - sigW) / 2;
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.2);
    doc.line(sigX, y + sigH + 2, sigX + sigW, y + sigH + 2);
    try {
      doc.addImage(closure.adminSignature, 'PNG', sigX, y, sigW, sigH);
    } catch (e) {
      logger.warn('No se pudo dibujar la firma del admin', e);
    }
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(closure.adminName, PAGE_W / 2, y + sigH + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('Administrador G5N', PAGE_W / 2, y + sigH + 12, { align: 'center' });

    // Footer
    const totalPages = (doc as any).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, 285, PAGE_W - MARGIN, 285);
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Gruas 5 Norte · Panamericana Norte Km. 841, Copiapó', MARGIN, 290);
      doc.text('+56 9 62380627 · asistencia@gruas5norte.cl', MARGIN, 293.5);
      doc.text(`Página ${p} de ${totalPages}`, PAGE_W - MARGIN, 293.5, { align: 'right' });
    }

    return doc.output('blob');
  } catch (error) {
    logger.error('Error generando ACTA externa:', error);
    throw new Error('Error al generar el PDF del Acta');
  }
};
