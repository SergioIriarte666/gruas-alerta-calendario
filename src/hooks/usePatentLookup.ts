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
  patente: string;
  timestamp: number;
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

const HISTORY_KEY = 'patent_lookup_history';
const MAX_HISTORY_ITEMS = 10;

export const usePatentLookup = (): UsePatentLookupReturn => {
  const [data, setData] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistory[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  }, []);

  // Save search to history
  const saveToHistory = (licensePlate: string, vehicleData: VehicleData) => {
    const newItem: SearchHistory = {
      ...vehicleData,
      patente: licensePlate,
      timestamp: Date.now(),
    };

    const updatedHistory = [newItem, ...history.filter(h => h.patente !== licensePlate)]
      .slice(0, MAX_HISTORY_ITEMS);
    
    setHistory(updatedHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
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
        saveToHistory(licensePlate.trim(), result.data);
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

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    toast.success('Historial eliminado');
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
