
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { generateInspectionPDF } from './inspectionPdfGenerator';

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
    console.log(`PDF Progress: ${progress}% - ${step}`);
  }

  async generateWithProgress(data: {
    service: Service;
    inspection: InspectionFormValues;
  }): Promise<{ blob: Blob; downloadUrl: string }> {
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
      const totalPhotos = [
        ...(data.inspection.photosBeforeService || []),
        ...(data.inspection.photosClientVehicle || []),
        ...(data.inspection.photosEquipmentUsed || [])
      ].length;
      
      console.log(`Total de fotos a procesar: ${totalPhotos}`);
      
      this.updateProgress(60, 'Procesando fotografías...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      this.updateProgress(80, 'Generando documento PDF...');
      
      // Generar el PDF usando el generador existente
      const pdfBlob = await generateInspectionPDF(data);
      
      this.updateProgress(95, 'Preparando descarga...');
      
      // Crear URL de descarga
      const downloadUrl = URL.createObjectURL(pdfBlob);
      
      this.updateProgress(100, 'PDF generado exitosamente');
      
      return { blob: pdfBlob, downloadUrl };
      
    } catch (error) {
      console.error('Error en generación de PDF:', error);
      throw new Error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  async downloadPDF(
    blob: Blob, 
    filename: string,
    fallbackUrl?: string
  ): Promise<boolean> {
    try {
      // Intentar descarga automática
      const link = document.createElement('a');
      const url = fallbackUrl || URL.createObjectURL(blob);
      
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpiar URL después de un delay
      setTimeout(() => {
        if (!fallbackUrl) {
          URL.revokeObjectURL(url);
        }
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('Error en descarga automática:', error);
      return false;
    }
  }
}

export const createPDFGenerator = (progressCallback?: ProgressCallback) => {
  return new EnhancedPDFGenerator(progressCallback);
};
