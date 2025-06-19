
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';

export const useFolioGenerator = () => {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);

  const generateNextFolio = useCallback(async (): Promise<string> => {
    setLoading(true);
    try {
      console.log('🔄 Generating new folio...');
      
      // Obtener el formato de folio de la configuración de la empresa
      const folioFormat = settings.company?.folioFormat || 'SRV-{number}';
      console.log('📋 Using folio format:', folioFormat);
      
      // Obtener el último folio de la base de datos
      const { data: services, error } = await supabase
        .from('services')
        .select('folio')
        .order('created_at', { ascending: false })
        .limit(10); // Get more records to ensure we find the highest number

      if (error) {
        console.error('❌ Error fetching services:', error);
        throw error;
      }

      console.log('📊 Found services:', services?.length || 0);

      let nextNumber = 1;

      if (services && services.length > 0) {
        // Extraer todos los números de los folios y encontrar el más alto
        const numbers = services
          .map(service => {
            const match = service.folio.match(/(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          })
          .filter(num => num > 0);

        if (numbers.length > 0) {
          nextNumber = Math.max(...numbers) + 1;
        }
      }

      // Generar el nuevo folio usando el formato configurado
      const newFolio = folioFormat.replace('{number}', String(nextNumber).padStart(3, '0'));
      console.log('✅ Generated new folio:', newFolio);
      
      return newFolio;
    } catch (error: any) {
      console.error('❌ Error generating folio:', error);
      toast.error("Error", {
        description: "No se pudo generar el folio automáticamente.",
      });
      // Retornar un folio por defecto basado en timestamp
      const timestamp = Date.now();
      const fallbackFolio = `SRV-${String(timestamp).slice(-3)}`;
      console.log('🔧 Using fallback folio:', fallbackFolio);
      return fallbackFolio;
    } finally {
      setLoading(false);
    }
  }, [settings.company]);

  const validateFolioUniqueness = useCallback(async (folio: string): Promise<boolean> => {
    try {
      console.log('🔍 Validating folio uniqueness:', folio);
      
      const { data, error } = await supabase
        .from('services')
        .select('id, folio')
        .eq('folio', folio)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error validating folio:', error);
        throw error;
      }

      const isUnique = !data;
      console.log(isUnique ? '✅ Folio is unique' : '⚠️ Folio already exists');
      
      return isUnique;
    } catch (error: any) {
      console.error('❌ Error validating folio uniqueness:', error);
      toast.error("Error", {
        description: "No se pudo validar la unicidad del folio.",
      });
      return false;
    }
  }, []);

  return {
    generateNextFolio,
    validateFolioUniqueness,
    loading
  };
};
