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
      // Obtener el formato de folio de la configuración de la empresa
      const folioFormat = settings.company?.folioFormat || 'SRV-{number}';
      
      // Obtener el último folio de la base de datos
      const { data: lastService, error } = await supabase
        .from('services')
        .select('folio')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 es "no rows returned"
        throw error;
      }

      let nextNumber = 1;

      if (lastService?.folio) {
        // Extraer el número del último folio
        const match = lastService.folio.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      // Generar el nuevo folio usando el formato configurado
      const newFolio = folioFormat.replace('{number}', String(nextNumber).padStart(3, '0'));
      
      return newFolio;
    } catch (error: any) {
      console.error('Error generating folio:', error);
      toast.error("Error", {
        description: "No se pudo generar el folio automáticamente.",
      });
      // Retornar un folio por defecto en caso de error
      return `SRV-${String(Date.now()).slice(-3)}`;
    } finally {
      setLoading(false);
    }
  }, [settings.company]);

  const validateFolioUniqueness = useCallback(async (folio: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id')
        .eq('folio', folio)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !data; // Retorna true si no existe (es único)
    } catch (error: any) {
      console.error('Error validating folio uniqueness:', error);
      return false;
    }
  }, []);

  return {
    generateNextFolio,
    validateFolioUniqueness,
    loading
  };
};
