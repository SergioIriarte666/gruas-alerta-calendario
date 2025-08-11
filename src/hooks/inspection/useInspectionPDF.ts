
import { useState } from 'react';
import { createPDFGenerator } from '@/utils/enhancedPdfGenerator';
import { InspectionFormValues } from '@/schemas/inspectionSchema';

export const useInspectionPDF = () => {
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStep, setPdfStep] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string>();

  const generatePDF = async (service: any, inspection: InspectionFormValues, isFinal: boolean = true) => {
    console.log('📄 [PDF] Iniciando generación de PDF...');
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
      
      const filename = `Inspeccion-${service.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      await pdfGenerator.downloadPDF(blob, filename, downloadUrl);
      
      console.log('✅ [PDF] PDF generado exitosamente');
      return { blob, filename };
    } catch (error) {
      console.error('💥 [PDF] Error generando PDF:', error);
      throw error;
    }
  };

  const handleManualDownload = (service: any) => {
    if (pdfDownloadUrl && service) {
      const link = document.createElement('a');
      link.href = pdfDownloadUrl;
      link.download = `Inspeccion-${service.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
    }
  };

  const cleanupPDF = () => {
    setTimeout(() => {
      setIsGeneratingPDF(false);
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
    cleanupPDF
  };
};
