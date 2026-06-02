import { useState } from 'react';
import { generateServiceDetailsPDF } from '@/utils/pdf/serviceDetailsPdfGenerator';
import { toast } from 'sonner';

import { getTodayLocal } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceDetailsPDF");
export const useServiceDetailsPDF = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const generatePDF = async (
    serviceData: any, 
    totalCosts: number, 
    totalCommissions: number, 
    netProfit: number
  ) => {
    setIsGenerating(true);
    
    try {
      logger.debug('📄 Generando PDF de detalles del servicio...');
      
      const blob = await generateServiceDetailsPDF({
        service: serviceData,
        totalCosts,
        totalCommissions,
        netProfit
      });
      
      // Descargar automáticamente
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Servicio-${serviceData.folio}-${getTodayLocal()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('PDF generado exitosamente');
      logger.debug('✅ PDF generado y descargado');
      
    } catch (error) {
      logger.error('❌ Error generando PDF:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };
  
  return { generatePDF, isGenerating };
};
