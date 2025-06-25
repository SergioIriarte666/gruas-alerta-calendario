
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionPDFData } from './pdf/pdfTypes';
import { addPDFHeader } from './pdf/pdfHeader';
import { addServiceInfo, addEquipmentChecklist, addObservationsAndSignatures } from './pdf/pdfSections';
import { addPhotosSection } from './pdf/pdfPhotos';
import { addDigitalSignatures } from './pdf/pdfSignatures';
import { fetchCompanyData } from './pdf/companyDataFetcher';
import { validateInspectionData } from './pdf/pdfValidation';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';

export const generateInspectionPDF = async (data: {
  service: Service;
  inspection: InspectionFormValues;
}): Promise<Blob> => {
  try {
    console.log('Iniciando generación de PDF con datos:', data);

    // Validar datos de entrada
    const validationErrors = validateInspectionData(data);
    if (validationErrors.length > 0) {
      throw new Error(`Errores de validación: ${validationErrors.join(', ')}`);
    }

    // Obtener datos de la empresa
    const companyData = await fetchCompanyData();
    console.log('=== DATOS DE EMPRESA FINALES ===', companyData);

    const doc = new jsPDF();
    
    // Filter out photos without fileName for PDF generation
    const validPhotos = data.inspection.photographicSet?.filter(
      (photo): photo is { fileName: string; category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor' } => 
        !!photo.fileName
    ) || [];
    
    const pdfData: InspectionPDFData = {
      service: data.service,
      inspection: {
        ...data.inspection,
        photographicSet: validPhotos
      },
      companyData
    };

    console.log('Generando PDF con datos completos:', {
      serviceId: pdfData.service.id,
      companyName: pdfData.companyData.businessName,
      equipmentCount: pdfData.inspection.equipment?.length || 0,
      photographicSetCount: validPhotos.length
    });

    // Add header corporativo (ahora es asíncrono)
    let yPosition = await addPDFHeader(doc, pdfData);
    console.log('Header agregado, yPosition:', yPosition);

    // Add service information
    yPosition = addServiceInfo(doc, pdfData, yPosition);
    console.log('Información de servicio agregada, yPosition:', yPosition);

    // Add equipment checklist
    yPosition = addEquipmentChecklist(doc, pdfData, yPosition);
    console.log('Checklist agregado, yPosition:', yPosition);

    // Add photographic set section
    try {
      if (validPhotos.length > 0) {
        console.log('Procesando set fotográfico:', validPhotos);
        const { addPhotographicSetSection } = await import('./pdf/pdfPhotos');
        yPosition = await addPhotographicSetSection(
          doc, 
          validPhotos, 
          yPosition
        );
        console.log('Set fotográfico agregado, yPosition:', yPosition);
      }
    } catch (photoError) {
      console.error('Error procesando set fotográfico:', photoError);
    }

    // Add digital signatures
    yPosition = await addDigitalSignatures(doc, pdfData, yPosition);
    console.log('Firmas digitales agregadas, yPosition:', yPosition);

    // Add observations and signatures (texto)
    addObservationsAndSignatures(doc, pdfData, yPosition);
    console.log('Observaciones agregadas');

    console.log('PDF generado exitosamente');
    return doc.output('blob');
  } catch (error) {
    console.error('Error crítico generando PDF:', error);
    throw new Error(`Error al generar el PDF de inspección: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};
