import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VehicleData {
  marca: string;
  modelo: string;
  año: number | null;
  color: string | null;
}

interface UsePatentLookupReturn {
  data: VehicleData | null;
  loading: boolean;
  error: string | null;
  lookupPatent: (licensePlate: string) => Promise<void>;
  reset: () => void;
}

export const usePatentLookup = (): UsePatentLookupReturn => {
  const [data, setData] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupPatent = async (licensePlate: string) => {
    if (!licensePlate || licensePlate.trim() === '') {
      toast.error('Por favor ingresa una patente válida');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke(
        'check-vehicle-patent',
        {
          body: { licensePlate: licensePlate.trim() },
        }
      );

      if (invokeError) {
        console.error('Error invoking function:', invokeError);
        setError('Error al consultar la patente');
        toast.error('Error al consultar la patente');
        return;
      }

      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setData(result.data);
        toast.success('Patente consultada exitosamente');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Error inesperado al consultar la patente');
      toast.error('Error inesperado al consultar la patente');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
  };

  return {
    data,
    loading,
    error,
    lookupPatent,
    reset,
  };
};
