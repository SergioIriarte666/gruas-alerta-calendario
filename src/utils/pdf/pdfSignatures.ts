
import jsPDF from 'jspdf';
import { InspectionPDFData } from './pdfTypes';

export const addDigitalSignatures = async (
  doc: jsPDF, 
  data: InspectionPDFData, 
  yPosition: number
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Verificar si necesitamos una nueva página
  if (yPosition > pageHeight - 100) {
    doc.addPage();
    yPosition = 20;
  }
  
  doc.setFontSize(14);
  doc.text('FIRMAS DIGITALES', 14, yPosition);
  yPosition += 15;
  
  // Calcular ancho para tres firmas
  const signatureWidth = (pageWidth - 56) / 3; // Espacio para 3 firmas con márgenes
  const signatureHeight = 35;
  const signatureSpacing = 14;
  
  try {
    let currentX = 14;
    
    // Firma del Operador
    if (data.inspection.operatorSignature) {
      doc.setFontSize(10);
      doc.text('Firma del Operador:', currentX, yPosition);
      
      // Agregar imagen de la firma
      doc.addImage(
        data.inspection.operatorSignature,
        'PNG',
        currentX,
        yPosition + 4,
        signatureWidth,
        signatureHeight
      );
      
      // Línea debajo de la firma
      doc.line(currentX, yPosition + signatureHeight + 6, currentX + signatureWidth, yPosition + signatureHeight + 6);
      
      // Nombre del operador
      const operatorName = data.service.operator?.name || 'Operador';
      doc.text(operatorName, currentX, yPosition + signatureHeight + 12);
    }
    
    currentX += signatureWidth + signatureSpacing;
    
    // Firma del Cliente (si existe)
    if (data.inspection.clientSignature) {
      doc.setFontSize(10);
      doc.text('Firma del Cliente:', currentX, yPosition);
      
      // Agregar imagen de la firma del cliente
      doc.addImage(
        data.inspection.clientSignature,
        'PNG',
        currentX,
        yPosition + 4,
        signatureWidth,
        signatureHeight
      );
      
      // Línea debajo de la firma
      doc.line(currentX, yPosition + signatureHeight + 6, currentX + signatureWidth, yPosition + signatureHeight + 6);
      
      // Nombre del cliente
      const clientName = data.inspection.clientName || 'Cliente';
      doc.text(clientName, currentX, yPosition + signatureHeight + 12);
    }
    
    currentX += signatureWidth + signatureSpacing;
    
    // Firma de Recepción del Vehículo (si existe)
    if (data.inspection.vehicleReceptionSignature) {
      doc.setFontSize(10);
      doc.text('Recepción del Vehículo:', currentX, yPosition);
      
      // Agregar imagen de la firma de recepción
      doc.addImage(
        data.inspection.vehicleReceptionSignature,
        'PNG',
        currentX,
        yPosition + 4,
        signatureWidth,
        signatureHeight
      );
      
      // Línea debajo de la firma
      doc.line(currentX, yPosition + signatureHeight + 6, currentX + signatureWidth, yPosition + signatureHeight + 6);
      
      // Nombre de quien recibe
      const receptionName = data.inspection.receptionPersonName || 'Recepción';
      doc.text(receptionName, currentX, yPosition + signatureHeight + 12);
    }
    
    yPosition += signatureHeight + 25;
    
  } catch (error) {
    console.error('Error adding digital signatures:', error);
    // Si hay error, agregar texto de respaldo
    doc.setFontSize(10);
    doc.text('Error al cargar las firmas digitales', 14, yPosition);
    yPosition += 15;
  }
  
  return yPosition;
};
