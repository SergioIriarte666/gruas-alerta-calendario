import { useState } from 'react';
import { toast } from 'sonner';
import { triggerFileDownload } from '@/utils/fileDownload';
import { createLogger } from "@/lib/logger";


const logger = createLogger("usePDFGeneration");
/**
 * Generic hook to generate a PDF Blob and trigger a browser download.
 * Uses triggerFileDownload from @/utils/fileDownload — mismo patrón que
 * CostDetailsModal y ConsolidatedCostDetails.
 */
export const usePDFGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndDownload = async (
    generatorFn: () => Promise<{ blob: Blob; fileName: string }>,
    fallbackFileName: string
  ) => {
    setIsGenerating(true);
    try {
      const { blob, fileName } = await generatorFn();
      const url = URL.createObjectURL(blob);
      triggerFileDownload(url, fileName || fallbackFileName);
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('PDF generado correctamente');
    } catch (error) {
      logger.error('[usePDFGeneration] Error:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return { isGenerating, generateAndDownload };
};