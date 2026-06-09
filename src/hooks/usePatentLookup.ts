import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isChileanPlate, isVIN } from '@/utils/vehicleIdentifiers';
import { createLogger } from '@/lib/logger';

const logger = createLogger('usePatentLookup');

// ── Tipos ──────────────────────────────────────────────────────────
export interface VehicleData {
  marca: string;
  modelo: string;
  año: number | null;
  color: string | null;
  // Campos Pro Light
  vin?: string | null;
  combustible?: string | null;
  transmision?: string | null;
  motor?: string | null;
  rtFecha?: string | null;
  rtResultado?: string | null;
  mesRT?: string | null;
}

export interface VinData {
  year: number | null;
  manufacturer: { name: string; region: string; country: string };
}

export interface StolenAlert {
  marca: string;
  modelo: string;
  color: string;
  patente: string;
  roboLugar: string;
  fechaRobo: string;
}

interface SearchHistory extends VehicleData {
  id: string;
  patente: string;
  created_at: string;
}

interface UsePatentLookupReturn {
  data: VehicleData | null;
  dataPlate: string | null;
  loading: boolean;
  error: string | null;
  vinData: VinData | null;
  vinLoading: boolean;
  stolenAlerts: StolenAlert[] | null;
  stolenLoading: boolean;
  history: SearchHistory[];
  lookupPatent: (licensePlate: string) => Promise<void>;
  lookupVin: (vin: string) => Promise<void>;
  lookupStolen: (plate: string) => Promise<void>;
  loadFromHistory: (item: SearchHistory) => void;
  clearHistory: () => void;
  reset: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');
  return { Authorization: `Bearer ${session.access_token}` };
};

// Intenta vehicle-api primero; si falla cae a check-vehicle-patent (solo endpoint plate)
const invokeVehicleApi = async (
  endpoint: string,
  value: string,
  headers: Record<string, string>
) => {
  try {
    const { data, error } = await supabase.functions.invoke('vehicle-api', {
      body: { endpoint, value },
      headers,
    });
    if (!error) return data;
  } catch {
    // vehicle-api no disponible — fallback solo para plate
  }

  if (endpoint === 'plate') {
    const { data, error } = await supabase.functions.invoke('check-vehicle-patent', {
      body: { licensePlate: value },
      headers,
    });
    if (error) throw error;
    return data;
  }

  return null;
};

// ── Hook ───────────────────────────────────────────────────────────
export const usePatentLookup = (): UsePatentLookupReturn => {
  const [data, setData]                     = useState<VehicleData | null>(null);
  const [dataPlate, setDataPlate]           = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [vinData, setVinData]               = useState<VinData | null>(null);
  const [vinLoading, setVinLoading]         = useState(false);
  const [stolenAlerts, setStolenAlerts]     = useState<StolenAlert[] | null>(null);
  const [stolenLoading, setStolenLoading]   = useState(false);
  const [history, setHistory]               = useState<SearchHistory[]>([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const { data: h } = await supabase
        .from('patent_search_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (h) setHistory(h);
    } catch (err) {
      logger.error('Error loading history:', err);
    }
  };

  const saveToHistory = async (plate: string, vehicleData: VehicleData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('patent_search_history').insert({
        user_id: user.id,
        patente: plate,
        marca: vehicleData.marca,
        modelo: vehicleData.modelo,
        año: vehicleData.año,
        color: vehicleData.color,
      });
      await loadHistory();
    } catch (err) {
      logger.error('Error saving to history:', err);
    }
  };

  // ── lookupStolen ──────────────────────────────────────────────────
  const lookupStolen = async (plate: string): Promise<void> => {
    setStolenLoading(true);
    try {
      const headers = await getAuthHeaders();
      const result = await invokeVehicleApi('stolen', plate, headers);
      if (result?.success && Array.isArray(result.data) && result.data.length > 0) {
        setStolenAlerts(result.data as StolenAlert[]);
        logger.warn(`[Stolen] Alerta robo para ${plate}:`, result.data);
      } else {
        setStolenAlerts(null);
      }
    } catch (err) {
      logger.error('Error lookup stolen:', err);
      setStolenAlerts(null);
    } finally {
      setStolenLoading(false);
    }
  };

  // ── lookupPatent ──────────────────────────────────────────────────
  const lookupPatent = async (licensePlate: string): Promise<void> => {
    if (!licensePlate?.trim()) return;

    const cleanValue = licensePlate.trim().replace(/[-\s]/g, '').toUpperCase();

    if (isVIN(cleanValue)) {
      await lookupVin(cleanValue);
      return;
    }

    if (!isChileanPlate(cleanValue)) {
      toast.error('Formato no reconocido. Ingresa una patente chilena válida.');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setStolenAlerts(null);

    try {
      const headers = await getAuthHeaders();

      // Consultar patente y robo en paralelo
      const [plateResult] = await Promise.all([
        invokeVehicleApi('plate', cleanValue, headers),
        lookupStolen(cleanValue),
      ]);

      if (!plateResult) {
        setError('No se encontró información para esta patente');
        toast.error('No se encontró información para esta patente');
        return;
      }

      // Manejar errores de la función (tanto vehicle-api como check-vehicle-patent)
      const errMsg = plateResult.error ?? plateResult.message;
      if (errMsg) {
        setError(errMsg);
        toast.error(errMsg);
        return;
      }

      // vehicle-api devuelve { success, data } — check-vehicle-patent devuelve { data }
      const raw = plateResult.success !== undefined
        ? (plateResult.success ? plateResult.data : null)
        : plateResult.data;

      if (!raw) {
        setError('No se encontró información para esta patente');
        toast.error('No se encontró información para esta patente');
        return;
      }

      const vehicleData: VehicleData = {
        marca:       raw.marca        ?? raw.model?.brand?.name ?? 'No disponible',
        modelo:      raw.modelo       ?? raw.model?.name        ?? 'No disponible',
        año:         raw.año          ?? raw.year               ?? null,
        color:       raw.color                                  ?? null,
        vin:         raw.vin          ?? raw.vinNumber          ?? null,
        combustible: raw.combustible  ?? raw.fuel               ?? null,
        transmision: raw.transmision  ?? raw.transmission       ?? null,
        motor:       raw.motor        ?? raw.engine             ?? null,
        rtFecha:     raw.rtFecha      ?? raw.rtDate             ?? null,
        rtResultado: raw.rtResultado  ?? raw.rtResult           ?? null,
        mesRT:       raw.mesRT        ?? raw.monthRT            ?? null,
      };

      setData(vehicleData);
      setDataPlate(cleanValue);
      await saveToHistory(cleanValue, vehicleData);
      toast.success('Patente consultada exitosamente');
    } catch (err) {
      logger.error('Error lookup patent:', err);
      setError('Error inesperado al consultar la patente');
      toast.error('Error inesperado al consultar la patente');
    } finally {
      setLoading(false);
    }
  };

  // ── lookupVin ─────────────────────────────────────────────────────
  const lookupVin = async (vin: string): Promise<void> => {
    const cleanVin = vin.trim().replace(/[-\s]/g, '').toUpperCase();
    if (!isVIN(cleanVin)) return;

    setVinLoading(true);
    setVinData(null);
    setData(null);

    try {
      const headers = await getAuthHeaders();
      const result = await invokeVehicleApi('vin', cleanVin, headers);

      if (result?.data) {
        setVinData({
          year: result.data.year ?? null,
          manufacturer: {
            name:    result.data.manufacturer?.name    ?? 'Desconocido',
            region:  result.data.manufacturer?.region  ?? '',
            country: result.data.manufacturer?.country ?? '',
          },
        });
      } else {
        toast.info('No se encontró información para este VIN');
      }
    } catch (err) {
      logger.error('Error lookup VIN:', err);
      toast.error('Error al consultar el VIN');
    } finally {
      setVinLoading(false);
    }
  };

  // ── reset ─────────────────────────────────────────────────────────
  const reset = () => {
    setData(null);
    setDataPlate(null);
    setError(null);
    setVinData(null);
    setStolenAlerts(null);
  };

  const loadFromHistory = (item: SearchHistory) => {
    setData({
      marca: item.marca,
      modelo: item.modelo,
      año: item.año,
      color: item.color,
    });
    setError(null);
  };

  const clearHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('patent_search_history').delete().eq('user_id', user.id);
      setHistory([]);
      toast.success('Historial eliminado');
    } catch (err) {
      logger.error('Error clearing history:', err);
      toast.error('Error al eliminar historial');
    }
  };

  return {
    data, dataPlate, loading, error,
    vinData, vinLoading,
    stolenAlerts, stolenLoading,
    history,
    lookupPatent, lookupVin, lookupStolen,
    loadFromHistory, clearHistory, reset,
  };
};
