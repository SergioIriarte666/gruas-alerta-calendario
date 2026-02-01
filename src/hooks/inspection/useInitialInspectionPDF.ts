import { useMutation } from '@tanstack/react-query';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';
import { useInspectionPDF } from './useInspectionPDF';
import { toast } from 'sonner';

export const useInitialInspectionPDF = () => {
  const { generatePDF, isGeneratingPDF } = useInspectionPDF();

  const generateInitialPDFMutation = useMutation({
    mutationFn: async ({ service, values }: { service: Service; values: InspectionFormValues }) => {
      console.log('📄 [INITIAL] Generando PDF de inspección inicial (pre-servicio)...');
      
      // Generar PDF inicial (isFinal = false indica inspección inicial/pre-servicio)
      const { blob, filename } = await generatePDF(service, values, false);
      
      // Modificar nombre del archivo para indicar que es inspección inicial
      const initialFilename = filename.replace('inspeccion', 'inspeccion_inicial').replace('retiro', 'pre_servicio');
      
      // Crear URL para descarga
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = initialFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return { blob, filename: initialFilename };
    },
    onSuccess: (result) => {
      console.log('✅ [INITIAL] PDF de inspección inicial generado:', result.filename);
      toast.success('PDF de Inspección Inicial descargado exitosamente');
    },
    onError: (error: Error) => {
      console.error('💥 [INITIAL] Error en PDF de inspección inicial:', error);
      toast.error(`Error al generar PDF: ${error.message}`);
    }
  });

  return {
    generateInitialPDF: generateInitialPDFMutation.mutate,
    isGeneratingInitialPDF: generateInitialPDFMutation.isPending || isGeneratingPDF,
  };
};
