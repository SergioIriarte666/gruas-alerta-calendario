
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionPDFData } from './pdf/pdfTypes';
import { addPDFHeader } from './pdf/pdfHeader';
import { addServiceInfo, addEquipmentChecklist, addObservationsAndSignatures } from './pdf/pdfSections';
import { addPhotosSection } from './pdf/pdfPhotos';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface CompanyData {
  businessName: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

const fetchCompanyData = async (): Promise<CompanyData> => {
  try {
    const { data, error } = await supabase
      .from('company_data')
      .select('*')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching company data:', error);
      return getDefaultCompanyData();
    }
    
    if (!data) {
      console.log('No company data found, using defaults');
      return getDefaultCompanyData();
    }
    
    return {
      businessName: data.business_name || 'TMS - Transport Management System',
      rut: data.rut || '12.345.678-9',
      address: data.address || 'Av. Principal 123, Santiago',
      phone: data.phone || '+56 9 1234 5678',
      email: data.email || 'contacto@tms.cl',
      logoUrl: data.logo_url
    };
  } catch (error) {
    console.error('Error in fetchCompanyData:', error);
    return getDefaultCompanyData();
  }
};

const getDefaultCompanyData = (): CompanyData => ({
  businessName: 'TMS - Transport Management System',
  rut: '12.345.678-9',
  address: 'Av. Principal 123, Santiago',
  phone: '+56 9 1234 5678',
  email: 'contacto@tms.cl'
});

const validateInspectionData = (data: {
  service: Service;
  inspection: InspectionFormValues;
}): string[] => {
  const errors: string[] = [];
  
  if (!data.service) {
    errors.push('Datos del servicio no disponibles');
  }
  
  if (!data.inspection) {
    errors.push('Datos de inspección no disponibles');
  }
  
  if (!data.inspection.operatorSignature) {
    errors.push('Firma del operador es requerida');
  }
  
  if (!data.inspection.equipment || data.inspection.equipment.length === 0) {
    errors.push('Debe seleccionar al menos un elemento del inventario');
  }
  
  // Verificar que hay al menos una foto
  const totalPhotos = [
    ...(data.inspection.photosBeforeService || []),
    ...(data.inspection.photosClientVehicle || []),
    ...(data.inspection.photosEquipmentUsed || [])
  ].length;
  
  if (totalPhotos === 0) {
    console.warn('No hay fotos adjuntas - PDF se generará sin imágenes');
  }
  
  return errors;
};

export const generateInspectionPDF = async (data: {
  service: Service;
  inspection: InspectionFormValues;
}): Promise<Blob> => {
  try {
    console.log('Iniciando generación de PDF con validación mejorada:', data);

    // Validar datos de entrada
    const validationErrors = validateInspectionData(data);
    if (validationErrors.length > 0) {
      throw new Error(`Errores de validación: ${validationErrors.join(', ')}`);
    }

    // Obtener datos reales de la empresa
    const companyData = await fetchCompanyData();
    console.log('Datos de empresa obtenidos:', companyData);

    const doc = new jsPDF();
    
    const pdfData: InspectionPDFData = {
      service: data.service,
      inspection: data.inspection,
      companyData
    };

    console.log('Datos del PDF preparados:', pdfData);

    // Add header con logo si está disponible
    let yPosition = await addPDFHeaderWithLogo(doc, pdfData);
    console.log('Header agregado, yPosition:', yPosition);

    // Add service information mejorada
    yPosition = addEnhancedServiceInfo(doc, pdfData, yPosition);
    console.log('Información de servicio agregada, yPosition:', yPosition);

    // Add equipment checklist
    yPosition = addEquipmentChecklist(doc, pdfData, yPosition);
    console.log('Checklist agregado, yPosition:', yPosition);

    // Add photos sections con mejor manejo de errores
    try {
      if (data.inspection.photosBeforeService && data.inspection.photosBeforeService.length > 0) {
        console.log('Procesando fotos antes del servicio:', data.inspection.photosBeforeService);
        yPosition = await addPhotosSection(
          doc, 
          'FOTOS ANTES DEL SERVICIO', 
          data.inspection.photosBeforeService, 
          yPosition
        );
        console.log('Fotos antes del servicio agregadas, yPosition:', yPosition);
      }
    } catch (photoError) {
      console.error('Error procesando fotos antes del servicio:', photoError);
      // Continuar con el resto del PDF
    }

    try {
      if (data.inspection.photosClientVehicle && data.inspection.photosClientVehicle.length > 0) {
        console.log('Procesando fotos del vehículo:', data.inspection.photosClientVehicle);
        yPosition = await addPhotosSection(
          doc, 
          'FOTOS DEL VEHÍCULO DEL CLIENTE', 
          data.inspection.photosClientVehicle, 
          yPosition
        );
        console.log('Fotos del vehículo agregadas, yPosition:', yPosition);
      }
    } catch (photoError) {
      console.error('Error procesando fotos del vehículo:', photoError);
      // Continuar con el resto del PDF
    }

    try {
      if (data.inspection.photosEquipmentUsed && data.inspection.photosEquipmentUsed.length > 0) {
        console.log('Procesando fotos del equipo:', data.inspection.photosEquipmentUsed);
        yPosition = await addPhotosSection(
          doc, 
          'FOTOS DEL EQUIPO UTILIZADO', 
          data.inspection.photosEquipmentUsed, 
          yPosition
        );
        console.log('Fotos del equipo agregadas, yPosition:', yPosition);
      }
    } catch (photoError) {
      console.error('Error procesando fotos del equipo:', photoError);
      // Continuar con el resto del PDF
    }

    // Add observations and signatures mejoradas
    addEnhancedObservationsAndSignatures(doc, pdfData, yPosition);
    console.log('Observaciones y firmas agregadas');

    console.log('PDF generado exitosamente');
    return doc.output('blob');
  } catch (error) {
    console.error('Error crítico generando PDF:', error);
    throw new Error(`Error al generar el PDF de inspección: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

const addPDFHeaderWithLogo = async (doc: jsPDF, data: InspectionPDFData): Promise<number> => {
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = 20;

  // Intentar cargar logo si está disponible
  if (data.companyData.logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const logoWidth = 30;
            const logoHeight = (img.height * logoWidth) / img.width;
            doc.addImage(img, 'PNG', 20, yPosition, logoWidth, logoHeight);
            console.log('Logo agregado al PDF');
            resolve(true);
          } catch (error) {
            console.error('Error agregando logo:', error);
            reject(error);
          }
        };
        img.onerror = reject;
        img.src = data.companyData.logoUrl!;
      });
    } catch (error) {
      console.warn('No se pudo cargar el logo, continuando sin él:', error);
    }
  }

  // Header con información de la empresa
  doc.setFontSize(20);
  doc.setTextColor(0, 150, 136); // tms-green
  doc.text('REPORTE DE INSPECCIÓN PRE-SERVICIO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(data.companyData.businessName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  doc.setFontSize(10);
  doc.text(`RUT: ${data.companyData.rut}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  doc.text(`${data.companyData.address} | ${data.companyData.phone} | ${data.companyData.email}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  return yPosition;
};

const addEnhancedServiceInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    // Información del servicio con más detalles
    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('DATOS DEL SERVICIO', 20, yPosition);
    yPosition += 10;

    const serviceData = [
      ['Folio:', data.service.folio || 'No especificado'],
      ['Cliente:', data.service.client?.name || 'No especificado'],
      ['RUT Cliente:', data.service.client?.rut || 'No especificado'],
      ['Tipo de Servicio:', data.service.serviceType?.name || 'No especificado'],
      ['Fecha:', data.service.serviceDate ? new Date(data.service.serviceDate).toLocaleDateString('es-CL') : 'No especificado'],
      ['Valor del Servicio:', `$${(data.service.value || 0).toLocaleString('es-CL')}`],
      ['Origen:', data.service.origin || 'No especificado'],
      ['Destino:', data.service.destination || 'No especificado'],
      ['Vehículo:', `${data.service.vehicleBrand || ''} ${data.service.vehicleModel || ''} - ${data.service.licensePlate || ''}`.trim()],
      ['Grúa:', `${data.service.crane?.licensePlate || 'No asignada'} (${data.service.crane?.brand || ''} ${data.service.crane?.model || ''})`.trim()],
      ['Operador:', data.service.operator?.name || 'No asignado'],
      ['Orden de Compra:', data.service.purchaseOrder || 'No especificada'],
    ];

    (doc as any).autoTable({
      startY: yPosition,
      body: serviceData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    });

    return (doc as any).lastAutoTable.finalY + 15;
  } catch (error) {
    console.error('Error en addEnhancedServiceInfo:', error);
    return yPosition + 50; // Fallback position
  }
};

const addEnhancedObservationsAndSignatures = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    // Verificar si necesitamos nueva página
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('OBSERVACIONES Y FIRMAS', 20, yPosition);
    yPosition += 15;

    const pageWidth = doc.internal.pageSize.width;

    if (data.inspection.vehicleObservations) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Observaciones del vehículo:', 20, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(data.inspection.vehicleObservations, pageWidth - 40);
      doc.text(splitText, 20, yPosition);
      yPosition += splitText.length * 5 + 10;
    }

    const signaturesData = [
      ['Firma del Operador:', data.inspection.operatorSignature || 'No especificado'],
      ['Cliente (si presente):', data.inspection.clientName || 'No especificado'],
      ['RUT del Cliente:', data.inspection.clientRut || 'No especificado'],
      ['Fecha de Inspección:', new Date().toLocaleDateString('es-CL')],
      ['Hora de Inspección:', new Date().toLocaleTimeString('es-CL')],
      ['Valor del Servicio:', `$${(data.service.value || 0).toLocaleString('es-CL')}`],
      ['Estado del Servicio:', data.service.status || 'No especificado'],
    ];

    (doc as any).autoTable({
      startY: yPosition,
      body: signaturesData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    });

    return (doc as any).lastAutoTable.finalY;
  } catch (error) {
    console.error('Error en addEnhancedObservationsAndSignatures:', error);
    return yPosition + 50; // Fallback position
  }
};
