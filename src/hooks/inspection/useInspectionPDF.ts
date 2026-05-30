import { useState } from 'react';
import { createPDFGenerator } from '@/utils/enhancedPdfGenerator';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { getTodayLocal } from '@/utils/timezoneUtils';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useInspectionPDF');

export const useInspectionPDF = () => {
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStep, setPdfStep] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string>();

  const generatePDF = async (service: any, inspection: InspectionFormValues, isFinal: boolean = true) => {
    logger.debug('Iniciando generación de PDF...');
    setIsGeneratingPDF(true);
    setPdfProgress(0);
    setPdfStep('Iniciando generación...');

    try {
      const pdfGenerator = createPDFGenerator((progress, step) => {
        setPdfProgress(progress);
        setPdfStep(step);
      });

      const { blob, downloadUrl } = await pdfGenerator.generateWithProgress({
        service: service,
        inspection: inspection,
        isFinal: isFinal,
      });

      setPdfDownloadUrl(downloadUrl);

      const filename = `Inspeccion-${service.folio}-${getTodayLocal()}.pdf`;
      await pdfGenerator.downloadPDF(blob, filename, downloadUrl);

      return { blob, filename };
    } catch (error) {
      logger.error('Error generando PDF:', error);
      // Resetear progreso para que el operador sepa que falló y pueda reintentar
      setPdfProgress(0);
      setPdfStep('Error al generar PDF');
      throw error;
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleManualDownload = (service: any) => {
    if (pdfDownloadUrl && service) {
      const link = document.createElement('a');
      link.href = pdfDownloadUrl;
      link.download = `Inspeccion-${service.folio}-${getTodayLocal()}.pdf`;
      link.click();
    }
  };

  const cleanupPDF = () => {
    setTimeout(() => {
      setPdfProgress(0);
      setPdfStep('');
      if (pdfDownloadUrl) {
        URL.revokeObjectURL(pdfDownloadUrl);
        setPdfDownloadUrl(undefined);
      }
    }, 5000);
  };

  return {
    pdfProgress,
    pdfStep,
    isGeneratingPDF,
    pdfDownloadUrl,
    generatePDF,
    handleManualDownload,
    cleanupPDF,
  };
};
