import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Generic hook to generate a PDF Blob and trigger a browser download.
 * Mirrors the pattern used by other PDF generators in src/utils/pdf/*.
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
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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