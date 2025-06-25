
import jsPDF from 'jspdf';
import { InspectionPDFData } from '../pdfTypes';

export const addObservationsAndSignatures = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Verificar si necesitamos una nueva página para las observaciones
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    // Observaciones del vehículo (si existen)
    if (data.inspection.vehicleObservations) {
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 136);
      doc.text('OBSERVACIONES DEL VEHICULO', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const splitObservations = doc.splitTextToSize(data.inspection.vehicleObservations, pageWidth - 40);
      doc.text(splitObservations, 20, yPosition);
      yPosition += splitObservations.length * 5 + 20;
    }

    // Footer con información de la empresa
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${data.companyData.businessName || 'Empresa'} - ${data.companyData.address || 'Direccion no disponible'}`, 20, yPosition);
    doc.text(`Tel: ${data.companyData.phone || 'N/A'} | Email: ${data.companyData.email || 'N/A'}`, 20, yPosition + 8);

    console.log('Observaciones agregadas correctamente (sin firmas duplicadas)');
    return yPosition + 20;
  } catch (error) {
    console.error('Error en addObservationsAndSignatures:', error);
    return yPosition + 50;
  }
};
