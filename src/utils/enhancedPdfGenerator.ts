
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { generateInspectionPDF } from './inspectionPdfGenerator';
import { createLogger } from "@/lib/logger";


const logger = createLogger("enhancedPdfGenerator");
interface ProgressCallback {
  (progress: number, step: string): void;
}

export class EnhancedPDFGenerator {
  private progressCallback?: ProgressCallback;

  constructor(progressCallback?: ProgressCallback) {
    this.progressCallback = progressCallback;
  }

  private updateProgress(progress: number, step: string) {
    if (this.progressCallback) {
      this.progressCallback(progress, step);
    }
    logger.debug(`PDF Progress: ${progress}% - ${step}`);
  }

  async generateWithProgress(data: {
    service: Service;
    inspection: InspectionFormValues;
    isFinal?: boolean;
  }): Promise<{ blob: Blob }> {
    try {
      this.updateProgress(10, 'Validando datos del formulario...');
      
      // Validar datos críticos
      if (!data.service) {
        throw new Error('Datos del servicio no disponibles');
      }
      
      if (!data.inspection.operatorSignature) {
        throw new Error('Firma del operador es requerida');
      }

      this.updateProgress(20, 'Preparando datos de la empresa...');
      
      // Simular delay para mostrar progreso
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.updateProgress(40, 'Cargando fotos del servicio...');
      
      // Verificar fotos disponibles
      const totalPhotos = data.inspection.photographicSet?.length || 0;
      
      logger.debug(`Total de fotos a procesar: ${totalPhotos}`);
      
      this.updateProgress(60, 'Procesando fotografías...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      this.updateProgress(80, 'Generando documento PDF...');
      
      // Generar el PDF usando el generador existente
      const pdfBlob = await generateInspectionPDF(data, data.isFinal);
      
      this.updateProgress(95, 'Finalizando documento...');
      
      this.updateProgress(100, 'PDF generado exitosamente');
      
      // El blob se mantiene en memoria. La UI crea una URL descargable recién
      // cuando la inspección, el PDF y el estado ya fueron persistidos.
      return { blob: pdfBlob };
      
    } catch (error) {
      logger.error('Error en generación de PDF:', error);
      throw new Error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

}

export const createPDFGenerator = (progressCallback?: ProgressCallback) => {
  return new EnhancedPDFGenerator(progressCallback);
};
