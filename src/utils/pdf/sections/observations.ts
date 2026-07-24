import jsPDF from 'jspdf';
import { InspectionPDFData } from '../pdfTypes';
import { createLogger } from "@/lib/logger";
import { REPORT_PDF_COLORS } from '../reportPdfTheme';


const logger = createLogger("observations");
const C = {
  green:     REPORT_PDF_COLORS.primary,
  grayLight: REPORT_PDF_COLORS.soft,
  black:     [20, 20, 20]    as [number, number, number],
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

    return yPosition;
  } catch (error) {
    logger.error('Error en addObservationsAndSignatures:', error);
    return yPosition + 30;
  }
};
