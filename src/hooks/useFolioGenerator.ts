import { businessClock } from '@/utils/businessClock';

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FolioGenerator');

export const useFolioGenerator = () => {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);

  /**
   * Pide el folio a la secuencia de Postgres (RPC next_service_folio).
   *
   * Antes esto era un leer-y-escribir en dos viajes contra
   * company_data.next_service_folio_number: dos formularios abiertos a la vez
   * sacaban el mismo número, y bajar el contador reciclaba folios ya usados y
   * borrados — así SRV-6887 se emitió dos veces.
   *
   * Ya no hay fallback por timestamp: ese camino fue el que produjo el folio
   * anómalo SRV-826894 (`SRV-${Date.now().slice(-6)}`). Si la base no entrega
   * folio, el error sube y el formulario no inventa uno.
   */
  const generateNextFolio = useCallback(async (): Promise<string> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('next_service_folio');

      if (error) throw error;
      if (!data || typeof data !== 'string') {
        throw new Error('La base de datos no devolvió un folio válido');
      }

      logger.debug('Folio emitido por la secuencia:', data);

      // La configuración en memoria muestra el correlativo: refrescarla.
      setTimeout(() => {
        window.dispatchEvent(new Event('settings-updated'));
      }, 100);

      return data;
    } catch (error: unknown) {
      logger.error('Error generando folio:', error);
      toast.error('No se pudo generar el folio', {
        description: 'Reintenta en unos segundos. No se creará un folio provisorio.',
      });
      throw error instanceof Error ? error : new Error('No se pudo generar el folio');
    } finally {
      setLoading(false);
    }
  }, []);

  const validateFolioUniqueness = useCallback(async (folio: string): Promise<boolean> => {
    try {
      logger.debug('🔍 Validating folio uniqueness:', folio);
      
      const { data, error } = await supabase
        .from('services')
        .select('id, folio')
        .eq('folio', folio)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('❌ Error validating folio:', error);
        throw error;
      }

      const isUnique = !data;
      logger.debug(isUnique ? '✅ Folio is unique' : '⚠️ Folio already exists');
      
      return isUnique;
    } catch (error: any) {
      logger.error('❌ Error validating folio uniqueness:', error);
      toast.error("Error", {
        description: "No se pudo validar la unicidad del folio.",
      });
      return false;
    }
  }, []);

  const syncFolioCounter = useCallback(async (manualFolio: string): Promise<void> => {
    try {
      logger.debug('🔄 Syncing folio counter for manual folio:', manualFolio);
      
      // Extraer número del folio manual si sigue el formato estándar
      const match = manualFolio.match(/^[A-Z]+-(\d+)$/);
      if (!match) {
        logger.debug('📝 Manual folio does not follow standard format, skipping sync');
        return;
      }

      const manualNumber = parseInt(match[1]);
      logger.debug('🔢 Manual folio number:', manualNumber);

      // Obtener datos actuales de la empresa
      const { data: companyData, error: fetchError } = await supabase
        .from('company_data')
        .select('id, next_service_folio_number')
        .limit(1)
        .maybeSingle();

      if (fetchError || !companyData) {
        logger.error('❌ Error fetching company data for sync:', fetchError);
        return;
      }

      const currentNumber = companyData.next_service_folio_number || 1000;
      
      // Si el número manual es mayor o igual al contador actual, actualizar
      if (manualNumber >= currentNumber) {
        const newNextNumber = manualNumber + 1;
        logger.debug('📈 Updating counter from', currentNumber, 'to', newNextNumber);

        const { error: updateError } = await supabase
          .from('company_data')
          .update({ 
            next_service_folio_number: newNextNumber,
            updated_at: businessClock.nowISO()
          })
          .eq('id', companyData.id);

        if (updateError) {
          logger.error('❌ Error syncing folio counter:', updateError);
        } else {
          logger.debug('✅ Folio counter synced successfully');
          // Disparar evento para actualizar la configuración en memoria
          setTimeout(() => {
            window.dispatchEvent(new Event('settings-updated'));
          }, 100);
        }
      } else {
        logger.debug('📊 Manual folio number is lower than current counter, no sync needed');
      }
    } catch (error: any) {
      logger.error('❌ Error syncing folio counter:', error);
    }
  }, []);

  const syncAllFoliosAfterBulkUpload = useCallback(async (folios: string[]): Promise<void> => {
    try {
      logger.debug('🔄 Syncing folio counter after bulk upload with', folios.length, 'folios');
      
      if (folios.length === 0) {
        logger.debug('📝 No folios to sync');
        return;
      }

      // Extraer números de todos los folios que siguen el formato estándar
      const folioNumbers: number[] = [];
      const folioFormat = settings.company?.folioFormat || 'SRV-{number}';
      const prefix = folioFormat.split('{number}')[0];
      
      for (const folio of folios) {
        if (folio.startsWith(prefix)) {
          const match = folio.match(/^[A-Z]+-(\d+)$/);
          if (match) {
            folioNumbers.push(parseInt(match[1]));
          }
        }
      }

      if (folioNumbers.length === 0) {
        logger.debug('📝 No standard format folios found, skipping sync');
        return;
      }

      // Encontrar el número máximo
      const maxNumber = Math.max(...folioNumbers);
      logger.debug('🔢 Maximum folio number found:', maxNumber);

      // Obtener datos actuales de la empresa
      const { data: companyData, error: fetchError } = await supabase
        .from('company_data')
        .select('id, next_service_folio_number')
        .limit(1)
        .maybeSingle();

      if (fetchError || !companyData) {
        logger.error('❌ Error fetching company data for bulk sync:', fetchError);
        return;
      }

      const currentNumber = companyData.next_service_folio_number || 1000;
      
      // Si el número máximo es mayor o igual al contador actual, actualizar
      if (maxNumber >= currentNumber) {
        const newNextNumber = maxNumber + 1;
        logger.debug('📈 Updating counter from', currentNumber, 'to', newNextNumber);

        const { error: updateError } = await supabase
          .from('company_data')
          .update({ 
            next_service_folio_number: newNextNumber,
            updated_at: businessClock.nowISO()
          })
          .eq('id', companyData.id);

        if (updateError) {
          logger.error('❌ Error syncing folio counter after bulk upload:', updateError);
        } else {
          logger.debug('✅ Folio counter synced successfully to', newNextNumber);
          toast.success('Contador de folios actualizado', {
            description: `Próximo folio disponible: ${folioFormat.replace('{number}', String(newNextNumber).padStart(4, '0'))}`
          });
          // Disparar evento para actualizar la configuración en memoria
          setTimeout(() => {
            window.dispatchEvent(new Event('settings-updated'));
          }, 100);
        }
      } else {
        logger.debug('📊 Maximum folio number is lower than current counter, no sync needed');
      }
    } catch (error: any) {
      logger.error('❌ Error syncing folio counter after bulk upload:', error);
    }
  }, [settings.company]);

  return {
    generateNextFolio,
    validateFolioUniqueness,
    syncFolioCounter,
    syncAllFoliosAfterBulkUpload,
    loading
  };
};
