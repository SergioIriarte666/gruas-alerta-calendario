import { useState } from 'react';
import { toast } from 'sonner';
import { triggerFileDownload } from '@/utils/fileDownload';

/**
 * Generic hook to generate a PDF Blob and trigger a browser download.
 * Uses triggerFileDownload from @/utils/fileDownload — mismo patrón que
 * CostDetailsModal y ConsolidatedCostDetails.
 */
export const usePDFGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndDownload = async (
    generatorFn: () => Promise<Blob>,
    fileName: string
  ) => {
    setIsGenerating(true);
    try {
      const blob = await generatorFn();
      const url = URL.createObjectURL(blob);
      triggerFileDownload(url, fileName);
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('[usePDFGeneration] Error:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return { isGenerating, generateAndDownload };
};