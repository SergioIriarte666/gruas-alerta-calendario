
import jsPDF from 'jspdf';
import { InspectionPDFData } from './pdfTypes';

export const addPDFHeader = (doc: jsPDF, data: InspectionPDFData): number => {
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = 20;

  // Header con logo y datos de la empresa
  doc.setFontSize(20);
  doc.setTextColor(0, 150, 136); // tms-green
  doc.text('REPORTE DE INSPECCIÓN PRE-SERVICIO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  if (data.companyData) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(data.companyData.businessName, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.setFontSize(10);
    doc.text(`RUT: ${data.companyData.rut}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    doc.text(`${data.companyData.address} | ${data.companyData.phone} | ${data.companyData.email}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
  }

  return yPosition;
};
