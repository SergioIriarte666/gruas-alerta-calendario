import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TelemetryMode } from '@/utils/telemetryMode';

const MAX_VALID_SPEED_KMH = 150;
const MOVING_SPEED_FLOOR_KMH = 5;

export type TelemetryCoverageStatus =
  | 'reliable'
  | 'review'
  | 'missing'
  | 'not_started'
  | 'external'
  | 'unexpected';

interface RawServiceTelemetryRow {
  service_id: string;
  service_date: string;
  folio: string;
  service_status: string;
  service_type_name: string;
  telemetry_mode: TelemetryMode;
  operator_id: string | null;
  operator_name: string;
  crane_id: string | null;
  crane_label: string;
  tracking_expected: boolean;
  operational_started_at: string | null;
  start_at: string | null;
  end_at: string | null;
  total_duration_minutes: number | null;
  reliable_distance_km: number;
  raw_points_count: number;
  trusted_points_count: number;
  gaps_count: number;
  low_confidence: boolean;
  max_speed_kmh: number | null;
  average_moving_speed_kmh: number | null;
  percentile95_speed_kmh: number | null;
  over_limit_episodes: number;
  speed_samples_count: number;
  coverage_status: TelemetryCoverageStatus;
  unexpected_telemetry: boolean;
}

export interface ServiceTelemetryRecord {
  serviceId: string;
  serviceDate: string;
  folio: string;
  serviceStatus: string;
  serviceTypeName: string;
  telemetryMode: TelemetryMode;
  operatorId: string | null;
  operatorName: string;
  craneId: string | null;
  craneLabel: string;
  trackingExpected: boolean;
  operationalStartedAt: string | null;
  startAt: string | null;
  endAt: string | null;
  totalDurationMinutes: number | null;
  reliableDistanceKm: number;
  rawPointsCount: number;
  trustedPointsCount: number;
  gapsCount: number;
  lowConfidence: boolean;
  maxSpeedKmh: number | null;
  averageMovingSpeedKmh: number | null;
  percentile95SpeedKmh: number | null;
  overLimitEpisodes: number;
  speedSamplesCount: number;
  coverageStatus: TelemetryCoverageStatus;
  unexpectedTelemetry: boolean;
}

export interface SpeedSampleSummary {
  maxSpeedKmh: number | null;
  averageMovingSpeedKmh: number | null;
  percentile95SpeedKmh: number | null;
  overLimitSamples: number;
  samplesCount: number;
}

const average = (values: number[]) => (
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
);

/**
 * Conservado como función pura para validaciones y consumidores secundarios.
 * La pantalla principal usa el agregado SQL, donde los excesos se agrupan en
 * episodios y las lecturas de baja precisión se excluyen antes del cálculo.
 */
export const summarizeSpeedSamples = (
  samplesKmh: number[],
  speedLimitKmh: number,
): SpeedSampleSummary => {
  const validSamples = samplesKmh.filter(
    (speed) => Number.isFinite(speed) && speed >= 0 && speed <= MAX_VALID_SPEED_KMH,
  );
  const movingSamples = validSamples
    .filter((speed) => speed >= MOVING_SPEED_FLOOR_KMH)
    .sort((a, b) => a - b);
  const percentileIndex = movingSamples.length > 0
    ? Math.max(0, Math.ceil(movingSamples.length * 0.95) - 1)
    : -1;

  return {
    maxSpeedKmh: validSamples.length > 0 ? Math.max(...validSamples) : null,
    averageMovingSpeedKmh: average(movingSamples),
    percentile95SpeedKmh: percentileIndex >= 0 ? movingSamples[percentileIndex] : null,
    overLimitSamples: validSamples.filter((speed) => speed > speedLimitKmh).length,
    samplesCount: validSamples.length,
  };
};

const fetchServiceTelemetry = async (
  dateFrom: string,
  dateTo: string,
  speedLimitKmh: number,
): Promise<ServiceTelemetryRecord[]> => {
  const { data, error } = await supabase.rpc('get_service_telemetry', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_speed_limit_kmh: speedLimitKmh,
  });

  if (error) {
    throw new Error(error.message || 'No se pudo cargar la telemetría de servicios');
  }

  return ((data ?? []) as RawServiceTelemetryRow[]).map((row) => ({
    serviceId: row.service_id,
    serviceDate: row.service_date,
    folio: row.folio,
    serviceStatus: row.service_status,
    serviceTypeName: row.service_type_name,
    telemetryMode: row.telemetry_mode,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    craneId: row.crane_id,
    craneLabel: row.crane_label,
    trackingExpected: row.tracking_expected,
    operationalStartedAt: row.operational_started_at,
    startAt: row.start_at,
    endAt: row.end_at,
    totalDurationMinutes: row.total_duration_minutes,
    reliableDistanceKm: Number(row.reliable_distance_km ?? 0),
    rawPointsCount: Number(row.raw_points_count ?? 0),
    trustedPointsCount: Number(row.trusted_points_count ?? 0),
    gapsCount: Number(row.gaps_count ?? 0),
    lowConfidence: row.low_confidence,
    maxSpeedKmh: row.max_speed_kmh,
    averageMovingSpeedKmh: row.average_moving_speed_kmh,
    percentile95SpeedKmh: row.percentile95_speed_kmh,
    overLimitEpisodes: Number(row.over_limit_episodes ?? 0),
    speedSamplesCount: Number(row.speed_samples_count ?? 0),
    coverageStatus: row.coverage_status,
    unexpectedTelemetry: row.unexpected_telemetry,
  }));
};

export const useServiceTelemetry = (
  dateFrom: string,
  dateTo: string,
  speedLimitKmh: number,
) => {
  const query = useQuery({
    queryKey: ['service-telemetry', dateFrom, dateTo, speedLimitKmh],
    queryFn: () => fetchServiceTelemetry(dateFrom, dateTo, speedLimitKmh),
    enabled: Boolean(
      dateFrom
      && dateTo
      && dateFrom <= dateTo
      && speedLimitKmh >= 10
      && speedLimitKmh <= MAX_VALID_SPEED_KMH
    ),
    staleTime: 60 * 1000,
  });

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
