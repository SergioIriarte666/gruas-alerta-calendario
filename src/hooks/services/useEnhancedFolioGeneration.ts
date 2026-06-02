import { useCallback } from 'react';
import { useFolioGenerator } from '@/hooks/useFolioGenerator';
import { useFolioValidation } from './useFolioValidation';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('EnhancedFolioGeneration');

export const useEnhancedFolioGeneration = () => {
  const { generateNextFolio, validateFolioUniqueness } = useFolioGenerator();
  const { validateFolio } = useFolioValidation();

  const generateUniqueValidFolio = useCallback(async (excludeServiceId?: string): Promise<string> => {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        logger.debug(`🔄 Generating unique folio attempt ${attempts + 1}/${maxAttempts}`);
        
        const candidateFolio = await generateNextFolio();
        logger.debug(`🔍 Checking uniqueness of folio: ${candidateFolio}`);
        
        // Validar que el folio sea único
        const validationResult = await validateFolio(candidateFolio, excludeServiceId);
        
        if (validationResult.isValid) {
          logger.debug(`✅ Generated unique folio: ${candidateFolio}`);
          return candidateFolio;
        } else {
          logger.debug(`❌ Folio ${candidateFolio} already exists, generating new one...`);
          attempts++;
        }
      } catch (error) {
        logger.error(`❌ Error in attempt ${attempts + 1}:`, error);
        attempts++;
      }
    }

    // Si después de todos los intentos no se pudo generar un folio único,
    // usar timestamp como fallback
    const fallbackFolio = `SRV-${Date.now().toString().slice(-6)}`;
    logger.debug(`🔧 Using timestamp-based fallback folio: ${fallbackFolio}`);
    
    toast.error('Advertencia', {
      description: 'Se generó un folio alternativo. Verifica que sea único antes de guardar.',
    });
    
    return fallbackFolio;
  }, [generateNextFolio, validateFolio]);

  const handleDuplicateFolio = useCallback(async (duplicatedFolio: string, excludeServiceId?: string): Promise<string> => {
    logger.debug(`🔄 Handling duplicate folio: ${duplicatedFolio}`);
    
    try {
      const newFolio = await generateUniqueValidFolio(excludeServiceId);
      
      toast.info('Folio Regenerado', {
        description: `El folio ${duplicatedFolio} ya existía. Se generó automáticamente: ${newFolio}`,
      });
      
      return newFolio;
    } catch (error) {
      logger.error('❌ Error handling duplicate folio:', error);
      throw error;
    }
  }, [generateUniqueValidFolio]);

  return {
    generateUniqueValidFolio,
    handleDuplicateFolio
  };
};