import { useMutation } from '@tanstack/react-query';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';
import { useInspectionPDF } from './useInspectionPDF';
import { toast } from 'sonner';

export const usePartialPDF = () => {
  const { generatePDF, isGeneratingPDF } = useInspectionPDF();

  const generatePartialPDFMutation = useMutation({
    mutationFn: async ({ service, values }: { service: Service; values: InspectionFormValues }) => {
      console.log('📄 [PARTIAL] Generando PDF parcial para retiro...');
      
      // Generar PDF parcial (sin firma de recepción)
      const { blob, filename } = await generatePDF(service, values, false);
      
      // Crear URL para descarga
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return { blob, filename };
    },
    onSuccess: (result) => {
      console.log('✅ [PARTIAL] PDF parcial generado:', result.filename);
      toast.success('PDF de retiro descargado exitosamente');
    },
    onError: (error: Error) => {
      console.error('💥 [PARTIAL] Error en PDF parcial:', error);
      toast.error(`Error al generar PDF de retiro: ${error.message}`);
    }
  });

  return {
    generatePartialPDF: generatePartialPDFMutation.mutate,
    isGeneratingPartialPDF: generatePartialPDFMutation.isPending || isGeneratingPDF,
  };
};