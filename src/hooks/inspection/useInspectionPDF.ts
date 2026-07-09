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

  const generatePDF = async (
    service: any,
    inspection: InspectionFormValues,
    isFinal: boolean = true,
    initialPhotos?: Array<{ fileName: string; category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor'; blob: Blob }>
  ) => {
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
        initialPhotos,
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

  const handleManualDownload = async (service: any) => {
    if (!pdfDownloadUrl || !service) return;
    const filename = `Inspeccion-${service.folio}-${getTodayLocal()}.pdf`;
    // En PWA iOS, <a download> con blob: navega el webview y al cerrar el visor la PWA se
    // recarga (se pierde el estado de la pantalla de éxito). El share sheet nativo se presenta
    // ENCIMA de la PWA sin recargarla, así que es la vía correcta en móvil.
    try {
      const resp = await fetch(pdfDownloadUrl);
      const blob = await resp.blob();
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (err) {
      // AbortError = el usuario canceló el share; no hacer fallback (evita doble acción).
      if (err instanceof DOMException && err.name === 'AbortError') return;
      logger.warn('Share no disponible, usando descarga por enlace:', err);
    }
    const link = document.createElement('a');
    link.href = pdfDownloadUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
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

  const beginPdfGeneration = useCallback((initialStep: string = 'Iniciando generación...') => {
    setIsGeneratingPDF(true);
    setPdfProgress(0);
    setPdfStep(initialStep);
  }, []);

  const updatePdfGeneration = useCallback((progress: number, step: string) => {
    setPdfProgress(progress);
    setPdfStep(step);
  }, []);

  const finishPdfGeneration = useCallback(() => {
    setIsGeneratingPDF(false);
  }, []);

  return {
    pdfProgress,
    pdfStep,
    isGeneratingPDF,
    pdfDownloadUrl,
    generatePDF,
    revealPDF,
    handleManualDownload,
    cleanupPDF,
    beginPdfGeneration,
    updatePdfGeneration,
    finishPdfGeneration,
  };
};
