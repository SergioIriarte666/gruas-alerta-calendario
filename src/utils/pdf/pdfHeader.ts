
import jsPDF from 'jspdf';
import { InspectionPDFData } from './pdfTypes';

export const addPDFHeader = (doc: jsPDF, data: InspectionPDFData): number => {
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = 20;

  try {
    // Intentar cargar logo si está disponible
    if (data.companyData?.logoUrl) {
      try {
        console.log('Intentando cargar logo:', data.companyData.logoUrl);
        // Por ahora, procedemos sin logo ya que requiere manejo async
        // En versiones futuras se puede implementar carga async del logo
      } catch (error) {
        console.warn('No se pudo cargar el logo:', error);
      }
    }

    // Header principal mejorado
    doc.setFontSize(18);
    doc.setTextColor(0, 150, 136); // tms-green
    doc.text('REPORTE DE INSPECCIÓN PRE-SERVICIO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Información de la empresa
    if (data.companyData) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(data.companyData.businessName, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`RUT: ${data.companyData.rut}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 6;
      
      doc.text(`${data.companyData.address}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
      
      doc.text(`Tel: ${data.companyData.phone} | Email: ${data.companyData.email}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
    }

    // Línea separadora
    doc.setDrawColor(0, 150, 136);
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 10;

    // Información del documento
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const now = new Date();
    const timestamp = now.toLocaleString('es-CL');
    doc.text(`Documento generado: ${timestamp}`, pageWidth - 20, yPosition, { align: 'right' });
    doc.text(`Folio: ${data.service.folio || 'N/A'}`, 20, yPosition);
    yPosition += 15;

    console.log('Header corporativo agregado correctamente');
    return yPosition;
  } catch (error) {
    console.error('Error en addPDFHeader:', error);
    return yPosition + 50; // Fallback position
  }
};
