import jsPDF from 'jspdf';
import { InspectionPDFData } from '../pdfTypes';

const C = {
  green:     [0, 130, 100]   as [number, number, number],
  grayLight: [248, 248, 248] as [number, number, number],
  gray:      [120, 120, 120] as [number, number, number],
  black:     [20, 20, 20]    as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};
const MARGIN = 14;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

export const addObservationsAndSignatures = (
  doc: jsPDF,
  data: InspectionPDFData,
  yPosition: number,
): number => {
  try {
    const pageHeight = doc.internal.pageSize.height;

    if (data.inspection.vehicleObservations?.trim()) {
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // Encabezado de sección con acento verde
      doc.setFillColor(...C.green);
      doc.rect(MARGIN, yPosition, 6, 10, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.green);
      doc.text('OBSERVACIONES DEL VEHÍCULO', MARGIN + 10, yPosition + 7);
      yPosition += 14;

      // Caja redondeada con fondo suave
      const obsLines = doc.splitTextToSize(data.inspection.vehicleObservations, CONTENT_W - 12);
      const obsH = obsLines.length * 5 + 10;

      doc.setFillColor(...C.grayLight);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(MARGIN, yPosition, CONTENT_W, obsH, 2, 2, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.black);
      doc.text(obsLines, MARGIN + 6, yPosition + 7);

      yPosition += obsH + 12;
    }

    // ── Footer en la última página ────────────────────────────────────────
    const footerY = pageHeight - 14;
    doc.setDrawColor(...C.green);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, footerY - 6, PAGE_W - MARGIN, footerY - 6);
    doc.setLineWidth(0.2);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(
      `${data.companyData.businessName} · ${data.companyData.address}`,
      PAGE_W / 2, footerY - 2, { align: 'center' }
    );
    doc.text(
      `Tel: ${data.companyData.phone} · Email: ${data.companyData.email}`,
      PAGE_W / 2, footerY + 3, { align: 'center' }
    );
    doc.text('Página 1', PAGE_W - MARGIN, footerY + 3, { align: 'right' });

    return yPosition;
  } catch (error) {
    console.error('Error en addObservationsAndSignatures:', error);
    return yPosition + 30;
  }
};
