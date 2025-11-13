import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VehicleData {
  marca: string;
  modelo: string;
  año: number | null;
  color: string | null;
}

interface SearchHistory extends VehicleData {
  id: string;
  patente: string;
  created_at: string;
}

interface UsePatentLookupReturn {
  data: VehicleData | null;
  loading: boolean;
  error: string | null;
  history: SearchHistory[];
  lookupPatent: (licensePlate: string) => Promise<void>;
  loadFromHistory: (historyItem: SearchHistory) => void;
  clearHistory: () => void;
  reset: () => void;
}

export const usePatentLookup = (): UsePatentLookupReturn => {
  const [data, setData] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistory[]>([]);

  // Load history from database on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data: historyData, error: historyError } = await supabase
        .from('patent_search_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyError) throw historyError;

      if (historyData) {
        setHistory(historyData);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  // Save search to database
  const saveToHistory = async (licensePlate: string, vehicleData: VehicleData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error: insertError } = await supabase
        .from('patent_search_history')
        .insert({
          user_id: userData.user.id,
          patente: licensePlate,
          marca: vehicleData.marca,
          modelo: vehicleData.modelo,
          año: vehicleData.año,
          color: vehicleData.color,
        });

      if (insertError) throw insertError;

      // Reload history after insert
      await loadHistory();
    } catch (err) {
      console.error('Error saving to history:', err);
    }
  };

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
        await saveToHistory(licensePlate.trim(), result.data);
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

  const loadFromHistory = (historyItem: SearchHistory) => {
    setData({
      marca: historyItem.marca,
      modelo: historyItem.modelo,
      año: historyItem.año,
      color: historyItem.color,
    });
    setError(null);
  };

  const clearHistory = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error: deleteError } = await supabase
        .from('patent_search_history')
        .delete()
        .eq('user_id', userData.user.id);

      if (deleteError) throw deleteError;

      setHistory([]);
      toast.success('Historial eliminado');
    } catch (err) {
      console.error('Error clearing history:', err);
      toast.error('Error al eliminar historial');
    }
  };

  return {
    data,
    loading,
    error,
    history,
    lookupPatent,
    loadFromHistory,
    clearHistory,
    reset,
  };
};
