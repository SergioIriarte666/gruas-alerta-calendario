import { useCallback, useEffect, useRef, useState } from 'react';
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
  const pdfDownloadUrlRef = useRef<string>();

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

      const { blob } = await pdfGenerator.generateWithProgress({
        service: service,
        inspection: inspection,
        isFinal: isFinal,
      });

      const filename = `Inspeccion-${service.folio}-${getTodayLocal()}.pdf`;
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

  const revealPDF = useCallback((blob: Blob) => {
    if (pdfDownloadUrlRef.current) {
      URL.revokeObjectURL(pdfDownloadUrlRef.current);
    }

    const downloadUrl = URL.createObjectURL(blob);
    pdfDownloadUrlRef.current = downloadUrl;
    setPdfDownloadUrl(downloadUrl);
  }, []);

  const handleManualDownload = (service: any) => {
    if (pdfDownloadUrl && service) {
      const link = document.createElement('a');
      link.href = pdfDownloadUrl;
      link.download = `Inspeccion-${service.folio}-${getTodayLocal()}.pdf`;
      link.click();
    }
  };

  const cleanupPDF = useCallback(() => {
    setPdfProgress(0);
    setPdfStep('');
    if (pdfDownloadUrlRef.current) {
      URL.revokeObjectURL(pdfDownloadUrlRef.current);
      pdfDownloadUrlRef.current = undefined;
    }
    setPdfDownloadUrl(undefined);
  }, []);

  useEffect(() => cleanupPDF, [cleanupPDF]);

  return {
    pdfProgress,
    pdfStep,
    isGeneratingPDF,
    pdfDownloadUrl,
    generatePDF,
    revealPDF,
    handleManualDownload,
    cleanupPDF,
  };
};
