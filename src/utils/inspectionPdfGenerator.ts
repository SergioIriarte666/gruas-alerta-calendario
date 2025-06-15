
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

  // Add header
  let yPosition = addPDFHeader(doc, pdfData);

  // Add service information
  yPosition = addServiceInfo(doc, pdfData, yPosition);

  // Add equipment checklist
  yPosition = addEquipmentChecklist(doc, pdfData, yPosition);

  // Add photos sections
  yPosition = await addPhotosSection(
    doc, 
    'FOTOS ANTES DEL SERVICIO', 
    data.inspection.photosBeforeService, 
    yPosition
  );

  yPosition = await addPhotosSection(
    doc, 
    'FOTOS DEL VEHÍCULO DEL CLIENTE', 
    data.inspection.photosClientVehicle, 
    yPosition
  );

  yPosition = await addPhotosSection(
    doc, 
    'FOTOS DEL EQUIPO UTILIZADO', 
    data.inspection.photosEquipmentUsed, 
    yPosition
  );

  // Add observations and signatures
  addObservationsAndSignatures(doc, pdfData, yPosition);

  return doc.output('blob');
};
