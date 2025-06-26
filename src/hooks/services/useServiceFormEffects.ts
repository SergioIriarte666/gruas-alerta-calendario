
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
  const hasGeneratedInitialFolio = useRef(false);

  // Generar folio automático cuando no es manual y no estamos editando
  useEffect(() => {
    // No generar folio si se está limpiando el formulario
    if (isClearing.current) {
      console.log('🚫 Skipping auto folio generation during form clear');
      isClearing.current = false;
      return;
    }

    // No generar folio si es manual
    if (isManualFolio) {
      console.log('📝 Skipping auto folio generation - manual mode');
      return;
    }

    // No generar folio si estamos editando un servicio existente
    if (service) {
      console.log('✏️ Skipping auto folio generation - editing existing service');
      return;
    }

    // Solo generar folio si no se ha generado uno inicial
    if (!hasGeneratedInitialFolio.current) {
      console.log('🔢 Auto-generating initial folio for new service');
      generateNextFolio().then((newFolio) => {
        setFolio(newFolio);
        hasGeneratedInitialFolio.current = true;
      });
    }
  }, [isManualFolio, service, generateNextFolio, setFolio]);

  const handleGenerateNewFolio = async () => {
    console.log('🔄 Manually generating new folio');
    const newFolio = await generateNextFolio();
    setFolio(newFolio);
    hasGeneratedInitialFolio.current = true;
  };

  // Función para marcar que se está limpiando el formulario
  const markAsClearing = () => {
    console.log('🧹 Marking form as clearing to prevent auto folio generation');
    isClearing.current = true;
    hasGeneratedInitialFolio.current = false; // Reset para permitir nueva generación
  };

  return { 
    handleGenerateNewFolio, 
    folioLoading,
    markAsClearing
  };
};
