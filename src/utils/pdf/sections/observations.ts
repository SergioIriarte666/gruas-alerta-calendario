
import jsPDF from 'jspdf';
import { InspectionPDFData } from '../pdfTypes';

export const addObservationsAndSignatures = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Verificar si necesitamos una nueva página para las firmas
    if (yPosition > 180) {
      doc.addPage();
      yPosition = 20;
    }

    // Observaciones
    if (data.inspection.vehicleObservations) {
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 136);
      doc.text('OBSERVACIONES DEL VEHICULO', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const splitObservations = doc.splitTextToSize(data.inspection.vehicleObservations, pageWidth - 40);
      doc.text(splitObservations, 20, yPosition);
      yPosition += splitObservations.length * 5 + 15;
    }

    // Verificar espacio para firmas antes de agregarlas
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    // Firmas
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 136);
    doc.text('FIRMAS Y VALIDACION', 20, yPosition);
    yPosition += 20;

    // Firma del operador
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('_____________________________', 30, yPosition);
    doc.text('Firma del Operador', 30, yPosition + 8);
    doc.text(`${data.inspection.operatorSignature}`, 30, yPosition + 16);

    // Firma del cliente (si existe)
    if (data.inspection.clientName) {
      doc.text('_____________________________', pageWidth - 100, yPosition);
      doc.text('Firma del Cliente', pageWidth - 100, yPosition + 8);
      doc.text(`${data.inspection.clientName}`, pageWidth - 100, yPosition + 16);
    }

    yPosition += 35;

    // Footer con información de la empresa
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${data.companyData.businessName || 'Empresa'} - ${data.companyData.address || 'Direccion no disponible'}`, 20, yPosition);
    doc.text(`Tel: ${data.companyData.phone || 'N/A'} | Email: ${data.companyData.email || 'N/A'}`, 20, yPosition + 8);

    console.log('Observaciones y firmas agregadas correctamente');
    return yPosition + 20;
  } catch (error) {
    console.error('Error en addObservationsAndSignatures:', error);
    return yPosition + 50;
  }
};
