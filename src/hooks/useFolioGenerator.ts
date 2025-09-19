
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
      console.log('🔄 Generating new folio with correlative numbering...');
      
      // Obtener el formato de folio y próximo número de la configuración de la empresa
      const folioFormat = settings.company?.folioFormat || 'SRV-{number}';
      let nextNumber = settings.company?.nextServiceFolioNumber || 1000;
      
      console.log('📋 Using folio format:', folioFormat);
      console.log('🔢 Next number from settings:', nextNumber);
      
      // Obtener los datos actuales de la empresa para usar la transacción
      const { data: companyData, error: fetchError } = await supabase
        .from('company_data')
        .select('id, next_service_folio_number')
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Error fetching company data:', fetchError);
        throw fetchError;
      }

      if (!companyData) {
        throw new Error('No se encontraron datos de la empresa');
      }

      // Usar el número más actualizado de la base de datos
      const currentNumber = companyData.next_service_folio_number || 1000;
      console.log('📊 Current number from database:', currentNumber);

      // Generar el nuevo folio
      const newFolio = folioFormat.replace('{number}', String(currentNumber).padStart(4, '0'));
      console.log('✅ Generated new folio:', newFolio);

      // Actualizar el próximo número en la base de datos
      const { error: updateError } = await supabase
        .from('company_data')
        .update({ 
          next_service_folio_number: currentNumber + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', companyData.id);

      if (updateError) {
        console.error('❌ Error updating next folio number:', updateError);
        throw updateError;
      }

      console.log('🔄 Updated next folio number to:', currentNumber + 1);
      
      // Disparar evento para actualizar la configuración en memoria
      setTimeout(() => {
        window.dispatchEvent(new Event('settings-updated'));
      }, 100);
      
      return newFolio;
    } catch (error: any) {
      console.error('❌ Error generating folio:', error);
      toast.error("Error", {
        description: "No se pudo generar el folio automáticamente.",
      });
      // Retornar un folio por defecto basado en timestamp como fallback
      const timestamp = Date.now();
      const fallbackFolio = `SRV-${String(timestamp).slice(-4)}`;
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

  const syncFolioCounter = useCallback(async (manualFolio: string): Promise<void> => {
    try {
      console.log('🔄 Syncing folio counter for manual folio:', manualFolio);
      
      // Extraer número del folio manual si sigue el formato estándar
      const match = manualFolio.match(/^[A-Z]+-(\d+)$/);
      if (!match) {
        console.log('📝 Manual folio does not follow standard format, skipping sync');
        return;
      }

      const manualNumber = parseInt(match[1]);
      console.log('🔢 Manual folio number:', manualNumber);

      // Obtener datos actuales de la empresa
      const { data: companyData, error: fetchError } = await supabase
        .from('company_data')
        .select('id, next_service_folio_number')
        .limit(1)
        .maybeSingle();

      if (fetchError || !companyData) {
        console.error('❌ Error fetching company data for sync:', fetchError);
        return;
      }

      const currentNumber = companyData.next_service_folio_number || 1000;
      
      // Si el número manual es mayor o igual al contador actual, actualizar
      if (manualNumber >= currentNumber) {
        const newNextNumber = manualNumber + 1;
        console.log('📈 Updating counter from', currentNumber, 'to', newNextNumber);

        const { error: updateError } = await supabase
          .from('company_data')
          .update({ 
            next_service_folio_number: newNextNumber,
            updated_at: new Date().toISOString()
          })
          .eq('id', companyData.id);

        if (updateError) {
          console.error('❌ Error syncing folio counter:', updateError);
        } else {
          console.log('✅ Folio counter synced successfully');
          // Disparar evento para actualizar la configuración en memoria
          setTimeout(() => {
            window.dispatchEvent(new Event('settings-updated'));
          }, 100);
        }
      } else {
        console.log('📊 Manual folio number is lower than current counter, no sync needed');
      }
    } catch (error: any) {
      console.error('❌ Error syncing folio counter:', error);
    }
  }, []);

  return {
    generateNextFolio,
    validateFolioUniqueness,
    syncFolioCounter,
    loading
  };
};
