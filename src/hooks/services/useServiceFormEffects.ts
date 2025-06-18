
import { useEffect } from 'react';
import { useFolioGenerator } from '@/hooks/useFolioGenerator';
import { Service } from '@/types';

export const useServiceFormEffects = (
  isManualFolio: boolean,
  service: Service | null | undefined,
  setFolio: (folio: string) => void
) => {
  const { generateNextFolio, loading: folioLoading } = useFolioGenerator();

  // Generar folio automático cuando no es manual y no estamos editando
  useEffect(() => {
    if (!isManualFolio && !service) {
      generateNextFolio().then(setFolio);
    }
  }, [isManualFolio, service, generateNextFolio, setFolio]);

  const handleGenerateNewFolio = async () => {
    const newFolio = await generateNextFolio();
    setFolio(newFolio);
  };

  return { handleGenerateNewFolio, folioLoading };
};
