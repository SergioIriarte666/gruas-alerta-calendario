import { useCallback } from 'react';
import { useFolioGenerator } from '@/hooks/useFolioGenerator';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('EnhancedFolioGeneration');

/**
 * El folio lo emite la secuencia `services_folio_seq` vía RPC
 * `next_service_folio()`, que ya avanza hasta encontrar un número libre y es
 * atómica. Este hook queda como la fachada que usa el formulario.
 *
 * Ya NO hay reintentos en el cliente ni fallback por timestamp: ese fallback
 * (`SRV-${Date.now().slice(-6)}`) fue el que emitió el folio anómalo
 * SRV-826894 el 22-07-2026. Si la base no entrega folio, el error sube y el
 * formulario avisa; nadie inventa un correlativo.
 */
export const useEnhancedFolioGeneration = () => {
  const { generateNextFolio } = useFolioGenerator();

  const generateUniqueValidFolio = useCallback(async (): Promise<string> => {
    const folio = await generateNextFolio();
    logger.debug('Folio único obtenido de la secuencia:', folio);
    return folio;
  }, [generateNextFolio]);

  const handleDuplicateFolio = useCallback(
    async (duplicatedFolio: string): Promise<string> => {
      const newFolio = await generateUniqueValidFolio();
      toast.info('Folio regenerado', {
        description: `El folio ${duplicatedFolio} ya existía. Se emitió: ${newFolio}`,
      });
      return newFolio;
    },
    [generateUniqueValidFolio],
  );

  return {
    generateUniqueValidFolio,
    handleDuplicateFolio,
  };
};
