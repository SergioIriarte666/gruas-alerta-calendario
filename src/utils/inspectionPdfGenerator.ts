
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionPDFData } from './pdf/pdfTypes';
import { addPDFHeader, PDF_HEADER_BADGE_COLORS, type PdfHeaderDocument } from './pdf/pdfHeader';
import { addServiceInfo, addEquipmentChecklist, resolveEquipmentChecklist, addObservationsAndSignatures } from './pdf/pdfSections';
import { fetchInspectionEquipmentCatalog } from '@/services/inspectionEquipmentCatalog';
import { addDigitalSignatures } from './pdf/pdfSignatures';
import { fetchCompanyData } from './pdf/companyDataFetcher';
import { validateInspectionData } from './pdf/pdfValidation';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';
import { isInSituService } from '@/utils/inspectionPhase';
import { createLogger } from "@/lib/logger";
import { addReportFooter } from './pdf/reportPdfTheme';


const logger = createLogger("inspectionPdfGenerator");
export const generateInspectionPDF = async (data: {
  service: Service;
  inspection: InspectionFormValues;
  initialPhotos?: Array<{ fileName: string; category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor'; blob: Blob }>;
  regenerationFooter?: string;
}, isFinal: boolean = true): Promise<Blob> => {
  try {
    logger.debug('Iniciando generación de PDF con datos:', data);

    // Derivar flag de detalle desde el tipo de servicio (default true)
    const requiresDetail = data.service?.serviceType?.requiresDetail ?? true;
    const isInSitu = isInSituService(data.service);

    // Validar datos de entrada respetando el flag del tipo de servicio
    const validationErrors = validateInspectionData(data, isFinal, { requiresDetail });
    if (validationErrors.length > 0) {
      throw new Error(`Errores de validación: ${validationErrors.join(', ')}`);
    }

    // Obtener datos de la empresa
    const companyData = await fetchCompanyData();
    logger.debug('=== DATOS DE EMPRESA FINALES ===', companyData);

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
      companyData,
      isFinal,
      isInSitu
    };

    logger.debug('Generando PDF con datos completos:', {
      serviceId: pdfData.service.id,
      companyName: pdfData.companyData.businessName,
      equipmentCount: pdfData.inspection.equipment?.length || 0,
      photographicSetCount: validPhotos.length
    });

    // El rótulo y el sello se deciden acá, junto a los flags que los definen:
    // el helper de header ya no adivina nada (así un comprobante de pago salió
    // rotulado "REPORTE DE INSPECCIÓN PRE-SERVICIO").
    const headerDocument: PdfHeaderDocument = isInSitu
      ? {
          documentTitle: 'ACTA DE SERVICIO',
          badge: { label: 'SERVICIO COMPLETADO', color: PDF_HEADER_BADGE_COLORS.final },
          folio: pdfData.service.folio,
        }
      : isFinal
        ? {
            documentTitle: 'INFORME FINAL DE SERVICIO',
            badge: { label: 'DOCUMENTO FINAL', color: PDF_HEADER_BADGE_COLORS.final },
            folio: pdfData.service.folio,
          }
        : {
            documentTitle: 'REPORTE DE INSPECCIÓN PRE-SERVICIO',
            badge: { label: 'PRE-SERVICIO', color: PDF_HEADER_BADGE_COLORS.provisional },
            folio: pdfData.service.folio,
          };

    // Add header corporativo (ahora es asíncrono)
    let yPosition = await addPDFHeader(doc, pdfData.companyData, headerDocument);
    logger.debug('Header agregado, yPosition:', yPosition);

    // Add service information
    yPosition = addServiceInfo(doc, pdfData, yPosition);
    logger.debug('Información de servicio agregada, yPosition:', yPosition);

    // Add equipment checklist solo si el servicio requiere detalle.
    // El catálogo se lee de inspection_equipment_items en cada generación: si
    // se hardcodea, el acta omite los ítems agregados después (así se perdió
    // "Foco Faenero", sort_order 36, en un acta con 35 ítems fijos).
    if (requiresDetail) {
      const equipmentCatalog = await fetchInspectionEquipmentCatalog();
      const checklist = resolveEquipmentChecklist(
        equipmentCatalog,
        data.inspection.equipmentStatus,
        data.inspection.equipment,
      );
      yPosition = addEquipmentChecklist(doc, checklist, yPosition);
      logger.debug('Checklist agregado, yPosition:', yPosition, {
        items: checklist.items.length,
        explicitStatus: checklist.hasExplicitStatus,
      });
    } else {
      logger.debug('Checklist omitido: servicio no requiere detalle');
    }

    // Add photographic set section
    try {
      const { addPhotographicSetSection } = await import('./pdf/pdfPhotos');
      if (isFinal && data.initialPhotos?.length) {
        logger.debug('Procesando set fotográfico de origen:', data.initialPhotos);
        yPosition = await addPhotographicSetSection(
          doc,
          data.initialPhotos,
          yPosition,
          'REGISTRO FOTOGRÁFICO — ORIGEN (CARGA)'
        );
        logger.debug('Set fotográfico de origen agregado, yPosition:', yPosition);
      }
      if (validPhotos.length > 0) {
        logger.debug('Procesando set fotográfico:', validPhotos);
        yPosition = await addPhotographicSetSection(
          doc,
          validPhotos,
          yPosition,
          isFinal ? 'REGISTRO FOTOGRÁFICO — ENTREGA (DESTINO)' : 'SET FOTOGRÁFICO'
        );
        logger.debug('Set fotográfico agregado, yPosition:', yPosition);
      }
    } catch (photoError) {
      logger.error('Error procesando set fotográfico:', photoError);
    }

    // Add digital signatures
    yPosition = await addDigitalSignatures(doc, pdfData, yPosition);
    logger.debug('Firmas digitales agregadas, yPosition:', yPosition);

    // Add observations and signatures (texto)
    addObservationsAndSignatures(doc, pdfData, yPosition);
    logger.debug('Observaciones agregadas');

    addReportFooter(doc, {
      leftLines: [
        [companyData.businessName, companyData.phone].filter(Boolean).join(' · '),
        data.regenerationFooter || companyData.email,
      ].filter((line): line is string => Boolean(line)),
    });

    logger.debug('PDF generado exitosamente');
    return doc.output('blob');
  } catch (error) {
    logger.error('Error crítico generando PDF:', error);
    throw new Error(`Error al generar el PDF de inspección: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};
