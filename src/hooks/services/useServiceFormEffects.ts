
import { useEffect, useRef } from 'react';
import { useFolioGenerator } from '@/hooks/useFolioGenerator';
import { Service } from '@/types';

export const useServiceFormEffects = (
  isManualFolio: boolean,
  service: Service | null | undefined,
  setFolio: (folio: string) => void
) => {
  const { generateNextFolio, loading: folioLoading } = useFolioGenerator();
  const isClearing = useRef(false);

  // Generar folio automático cuando no es manual y no estamos editando
  useEffect(() => {
    // No generar folio si se está limpiando el formulario
    if (isClearing.current) {
      console.log('🚫 Skipping auto folio generation during form clear');
      isClearing.current = false;
      return;
    }

    if (!isManualFolio && !service) {
      console.log('🔢 Auto-generating folio for new service');
      generateNextFolio().then(setFolio);
    }
  }, [isManualFolio, service, generateNextFolio, setFolio]);

  const handleGenerateNewFolio = async () => {
    console.log('🔄 Manually generating new folio');
    const newFolio = await generateNextFolio();
    setFolio(newFolio);
  };

  // Función para marcar que se está limpiando el formulario
  const markAsClearing = () => {
    console.log('🧹 Marking form as clearing to prevent auto folio generation');
    isClearing.current = true;
  };

  return { 
    handleGenerateNewFolio, 
    folioLoading,
    markAsClearing
  };
};
