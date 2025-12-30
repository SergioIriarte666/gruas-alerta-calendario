import { useCallback } from 'react';
import { useFolioGenerator } from '@/hooks/useFolioGenerator';
import { useFolioValidation } from './useFolioValidation';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { toast } from 'sonner';

export const useEnhancedFolioGeneration = () => {
  const { generateNextFolio, validateFolioUniqueness } = useFolioGenerator();
  const { validateFolio } = useFolioValidation();
  const { effectiveIsOnline } = useOfflineMode();

  const generateUniqueValidFolio = useCallback(async (excludeServiceId?: string): Promise<string> => {
    // En modo offline, generar folio directamente sin validación de duplicados
    // (la validación se hará al sincronizar)
    if (!effectiveIsOnline) {
      console.log('📴 Generating folio in offline mode (skip validation)');
      const folio = await generateNextFolio();
      console.log(`✅ Generated offline folio: ${folio}`);
      return folio;
    }

    // Modo online: validar unicidad
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 Generating unique folio attempt ${attempts + 1}/${maxAttempts}`);
        
        const candidateFolio = await generateNextFolio();
        console.log(`🔍 Checking uniqueness of folio: ${candidateFolio}`);
        
        // Validar que el folio sea único
        const validationResult = await validateFolio(candidateFolio, excludeServiceId);
        
        if (validationResult.isValid) {
          console.log(`✅ Generated unique folio: ${candidateFolio}`);
          return candidateFolio;
        } else {
          console.log(`❌ Folio ${candidateFolio} already exists, generating new one...`);
          attempts++;
        }
      } catch (error) {
        console.error(`❌ Error in attempt ${attempts + 1}:`, error);
        attempts++;
      }
    }

    // Si después de todos los intentos no se pudo generar un folio único,
    // usar timestamp como fallback
    const fallbackFolio = `SRV-${Date.now().toString().slice(-6)}`;
    console.log(`🔧 Using timestamp-based fallback folio: ${fallbackFolio}`);
    
    toast.error('Advertencia', {
      description: 'Se generó un folio alternativo. Verifica que sea único antes de guardar.',
    });
    
    return fallbackFolio;
  }, [generateNextFolio, validateFolio, effectiveIsOnline]);

  const handleDuplicateFolio = useCallback(async (duplicatedFolio: string, excludeServiceId?: string): Promise<string> => {
    console.log(`🔄 Handling duplicate folio: ${duplicatedFolio}`);
    
    try {
      const newFolio = await generateUniqueValidFolio(excludeServiceId);
      
      toast.info('Folio Regenerado', {
        description: `El folio ${duplicatedFolio} ya existía. Se generó automáticamente: ${newFolio}`,
      });
      
      return newFolio;
    } catch (error) {
      console.error('❌ Error handling duplicate folio:', error);
      throw error;
    }
  }, [generateUniqueValidFolio]);

  return {
    generateUniqueValidFolio,
    handleDuplicateFolio
  };
};