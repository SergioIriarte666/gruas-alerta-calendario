
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
  if (yPosition > pageHeight - 80) {
    doc.addPage();
    yPosition = 20;
  }
  
  doc.setFontSize(14);
  doc.text('FIRMAS DIGITALES', 14, yPosition);
  yPosition += 15;
  
  const signatureWidth = (pageWidth - 42) / 2; // Dividir espacio entre dos firmas
  const signatureHeight = 40;
  
  try {
    // Firma del Operador
    if (data.inspection.operatorSignature) {
      doc.setFontSize(10);
      doc.text('Firma del Operador:', 14, yPosition);
      yPosition += 6;
      
      // Agregar imagen de la firma
      doc.addImage(
        data.inspection.operatorSignature,
        'PNG',
        14,
        yPosition,
        signatureWidth,
        signatureHeight
      );
      
      // Línea debajo de la firma
      doc.line(14, yPosition + signatureHeight + 2, 14 + signatureWidth, yPosition + signatureHeight + 2);
      
      // Nombre del operador
      const operatorName = data.service.operator?.name || 'Operador';
      doc.text(operatorName, 14, yPosition + signatureHeight + 8);
    }
    
    // Firma del Cliente (si existe)
    if (data.inspection.clientSignature) {
      const clientX = 14 + signatureWidth + 14; // Posición X para la segunda firma
      
      doc.setFontSize(10);
      doc.text('Firma del Cliente:', clientX, yPosition);
      
      // Agregar imagen de la firma del cliente
      doc.addImage(
        data.inspection.clientSignature,
        'PNG',
        clientX,
        yPosition + 6,
        signatureWidth,
        signatureHeight
      );
      
      // Línea debajo de la firma
      doc.line(clientX, yPosition + signatureHeight + 8, clientX + signatureWidth, yPosition + signatureHeight + 8);
      
      // Nombre del cliente
      const clientName = data.inspection.clientName || 'Cliente';
      doc.text(clientName, clientX, yPosition + signatureHeight + 14);
    }
    
    yPosition += signatureHeight + 20;
    
  } catch (error) {
    console.error('Error adding digital signatures:', error);
    // Si hay error, agregar texto de respaldo
    doc.setFontSize(10);
    doc.text('Error al cargar las firmas digitales', 14, yPosition);
    yPosition += 15;
  }
  
  return yPosition;
};
