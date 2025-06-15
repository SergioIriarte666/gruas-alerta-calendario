
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionPDFData } from './pdf/pdfTypes';
import { addPDFHeader } from './pdf/pdfHeader';
import { addServiceInfo, addEquipmentChecklist, addObservationsAndSignatures } from './pdf/pdfSections';
import { addPhotosSection } from './pdf/pdfPhotos';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';

export const generateInspectionPDF = async (data: {
  service: Service;
  inspection: InspectionFormValues;
}): Promise<Blob> => {
  try {
    const doc = new jsPDF();
    
    const pdfData: InspectionPDFData = {
      service: data.service,
      inspection: data.inspection,
      companyData: {
        businessName: 'TMS - Transport Management System',
        rut: '12.345.678-9',
        address: 'Av. Principal 123, Santiago',
        phone: '+56 9 1234 5678',
        email: 'contacto@tms.cl'
      }
    };

    console.log('Iniciando generación de PDF con datos:', pdfData);

    // Add header
    let yPosition = addPDFHeader(doc, pdfData);
    console.log('Header agregado, yPosition:', yPosition);

    // Add service information
    yPosition = addServiceInfo(doc, pdfData, yPosition);
    console.log('Información de servicio agregada, yPosition:', yPosition);

    // Add equipment checklist
    yPosition = addEquipmentChecklist(doc, pdfData, yPosition);
    console.log('Checklist agregado, yPosition:', yPosition);

    // Add photos sections if they exist
    if (data.inspection.photosBeforeService && data.inspection.photosBeforeService.length > 0) {
      yPosition = await addPhotosSection(
        doc, 
        'FOTOS ANTES DEL SERVICIO', 
        data.inspection.photosBeforeService, 
        yPosition
      );
      console.log('Fotos antes del servicio agregadas, yPosition:', yPosition);
    }

    if (data.inspection.photosClientVehicle && data.inspection.photosClientVehicle.length > 0) {
      yPosition = await addPhotosSection(
        doc, 
        'FOTOS DEL VEHÍCULO DEL CLIENTE', 
        data.inspection.photosClientVehicle, 
        yPosition
      );
      console.log('Fotos del vehículo agregadas, yPosition:', yPosition);
    }

    if (data.inspection.photosEquipmentUsed && data.inspection.photosEquipmentUsed.length > 0) {
      yPosition = await addPhotosSection(
        doc, 
        'FOTOS DEL EQUIPO UTILIZADO', 
        data.inspection.photosEquipmentUsed, 
        yPosition
      );
      console.log('Fotos del equipo agregadas, yPosition:', yPosition);
    }

    // Add observations and signatures
    addObservationsAndSignatures(doc, pdfData, yPosition);
    console.log('Observaciones y firmas agregadas');

    console.log('PDF generado exitosamente');
    return doc.output('blob');
  } catch (error) {
    console.error('Error generando PDF:', error);
    throw new Error('Error al generar el PDF de inspección');
  }
};
