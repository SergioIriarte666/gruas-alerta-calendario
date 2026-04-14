import { useState } from 'react';
import { generateServiceDetailsPDF } from '@/utils/pdf/serviceDetailsPdfGenerator';
import { toast } from 'sonner';

import { getTodayLocal } from '@/utils/timezoneUtils';

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
      console.log('📄 Generando PDF de detalles del servicio...');
      
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
      console.log('✅ PDF generado y descargado');
      
    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };
  
  return { generatePDF, isGenerating };
};
