import { useQuery } from '@tanstack/react-query';
import { fromZonedTime } from 'date-fns-tz';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';

const PAGE_SIZE = 1000;
const SERVICE_ID_CHUNK_SIZE = 80;
const MAX_VALID_SPEED_KMH = 150;
const MOVING_SPEED_FLOOR_KMH = 5;
const QUERY_BUFFER_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface RawRouteMetrics {
  total_distance_km: number;
  matched_total_distance_km: number | null;
  total_duration_minutes: number;
  first_point_at: string;
  last_point_at: string;
  points_count: number;
  gaps_count: number;
  low_confidence: boolean;
}

interface RawService {
  id: string;
  folio: string;
  service_date: string;
  start_time: string | null;
  end_time: string | null;
  operator_id: string | null;
  crane_id: string | null;
  operator: { id: string; name: string } | null;
  crane: { id: string; license_plate: string } | null;
  route_metrics: RawRouteMetrics | null;
}

interface RawSpeedPoint {
  service_id: string | null;
  operator_id: string;
  speed_mps: number | null;
  recorded_at: string;
  accuracy_meters: number | null;
  operator: { id: string; name: string } | null;
}

export interface ServiceTelemetryRecord {
  serviceId: string;
  serviceDate: string;
  folio: string;
  operatorId: string | null;
  operatorName: string;
  craneId: string | null;
  craneLabel: string;
  startAt: string | null;
  endAt: string | null;
  totalDistanceKm: number | null;
  totalDurationMinutes: number | null;
  gpsPointsCount: number;
  gapsCount: number;
  lowConfidence: boolean;
  speedSamplesKmh: number[];
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

export const summarizeSpeedSamples = (
  samplesKmh: number[],
  speedLimitKmh: number,
): SpeedSampleSummary => {
  const validSamples = samplesKmh.filter(
    (speed) => Number.isFinite(speed) && speed >= 0 && speed <= MAX_VALID_SPEED_KMH,
  );
  const sorted = [...validSamples].sort((a, b) => a - b);
  const movingSamples = validSamples.filter((speed) => speed >= MOVING_SPEED_FLOOR_KMH);
  const percentileIndex = sorted.length > 0
    ? Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
    : -1;

  return {
    maxSpeedKmh: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    averageMovingSpeedKmh: average(movingSamples),
    percentile95SpeedKmh: percentileIndex >= 0 ? sorted[percentileIndex] : null,
    overLimitSamples: validSamples.filter((speed) => speed > speedLimitKmh).length,
    samplesCount: validSamples.length,
  };
};

const chunk = <T,>(values: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

const fetchServices = async (dateFrom: string, dateTo: string): Promise<RawService[]> => {
  const rows: RawService[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('services')
      .select(`
        id,
        folio,
        service_date,
        start_time,
        end_time,
        operator_id,
        crane_id,
        operator:operators!services_operator_id_fkey(id, name),
        crane:cranes!services_crane_id_fkey(id, license_plate),
        route_metrics:service_route_metrics(
          total_distance_km,
          matched_total_distance_km,
          total_duration_minutes,
          first_point_at,
          last_point_at,
          points_count,
          gaps_count,
          low_confidence
        )
      `)
      .gte('service_date', dateFrom)
      .lte('service_date', dateTo)
      .order('service_date', { ascending: false })
      .order('folio', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message || 'No se pudieron cargar los servicios');

    const page = (data ?? []) as unknown as RawService[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
};

const fetchSpeedPoints = async (
  serviceIds: string[],
  dateFrom: string,
  dateTo: string,
): Promise<RawSpeedPoint[]> => {
  if (serviceIds.length === 0) return [];

  const timezone = businessClock.timezone();
  const startMs = fromZonedTime(`${dateFrom}T00:00:00`, timezone).getTime()
    - QUERY_BUFFER_DAYS * DAY_MS;
  const endMs = fromZonedTime(`${dateTo}T23:59:59.999`, timezone).getTime()
    + QUERY_BUFFER_DAYS * DAY_MS;

  const pagesByChunk = await Promise.all(chunk(serviceIds, SERVICE_ID_CHUNK_SIZE).map(async (ids) => {
    const rows: RawSpeedPoint[] = [];

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('operator_location_points')
        .select(`
          service_id,
          operator_id,
          speed_mps,
          recorded_at,
          accuracy_meters,
          operator:operators!operator_location_points_operator_id_fkey(id, name)
        `)
        .in('service_id', ids)
        .gte('recorded_at', new Date(startMs).toISOString())
        .lte('recorded_at', new Date(endMs).toISOString())
        .order('recorded_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw new Error(error.message || 'No se pudieron cargar las velocidades GPS');

      const page = (data ?? []) as unknown as RawSpeedPoint[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    return rows;
  }));

  return pagesByChunk.flat();
};

const chileServiceWindow = (
  service: RawService,
): { startMs: number; endMs: number } => {
  const routeMetrics = service.route_metrics;
  if (routeMetrics) {
    return {
      startMs: new Date(routeMetrics.first_point_at).getTime(),
      endMs: new Date(routeMetrics.last_point_at).getTime(),
    };
  }

  const timezone = businessClock.timezone();
  const startTime = service.start_time?.slice(0, 8) ?? '00:00:00';
  const startMs = fromZonedTime(`${service.service_date}T${startTime}`, timezone).getTime();

  if (!service.end_time) {
    return { startMs, endMs: startMs + 36 * 60 * 60 * 1000 };
  }

  let endMs = fromZonedTime(
    `${service.service_date}T${service.end_time.slice(0, 8)}`,
    timezone,
  ).getTime();
  if (endMs < startMs) endMs += DAY_MS;

  return { startMs, endMs };
};

const fetchServiceTelemetry = async (
  dateFrom: string,
  dateTo: string,
): Promise<ServiceTelemetryRecord[]> => {
  const services = await fetchServices(dateFrom, dateTo);
  const points = await fetchSpeedPoints(services.map((service) => service.id), dateFrom, dateTo);
  const pointsByService = new Map<string, RawSpeedPoint[]>();

  for (const point of points) {
    if (!point.service_id) continue;
    const group = pointsByService.get(point.service_id) ?? [];
    group.push(point);
    pointsByService.set(point.service_id, group);
  }

  return services.map((service) => {
    const window = chileServiceWindow(service);
    const servicePoints = (pointsByService.get(service.id) ?? []).filter((point) => {
      const recordedMs = new Date(point.recorded_at).getTime();
      return recordedMs >= window.startMs && recordedMs <= window.endMs;
    });
    const firstReporter = servicePoints.find((point) => point.operator)?.operator ?? null;
    const metrics = service.route_metrics;

    return {
      serviceId: service.id,
      serviceDate: service.service_date,
      folio: service.folio,
      operatorId: service.operator?.id ?? firstReporter?.id ?? service.operator_id,
      operatorName: service.operator?.name ?? firstReporter?.name ?? 'Sin operador asignado',
      craneId: service.crane?.id ?? service.crane_id,
      craneLabel: service.crane
        ? service.crane.license_plate.toUpperCase()
        : 'Sin grúa asignada',
      startAt: servicePoints[0]?.recorded_at ?? metrics?.first_point_at ?? null,
      endAt: servicePoints[servicePoints.length - 1]?.recorded_at ?? metrics?.last_point_at ?? null,
      totalDistanceKm: metrics
        ? metrics.matched_total_distance_km ?? metrics.total_distance_km
        : null,
      totalDurationMinutes: metrics?.total_duration_minutes ?? null,
      gpsPointsCount: metrics?.points_count ?? servicePoints.length,
      gapsCount: metrics?.gaps_count ?? 0,
      lowConfidence: metrics?.low_confidence ?? servicePoints.length < 10,
      speedSamplesKmh: servicePoints
        .map((point) => (
          typeof point.speed_mps === 'number' ? point.speed_mps * 3.6 : Number.NaN
        ))
        .filter((speed) => Number.isFinite(speed) && speed >= 0 && speed <= MAX_VALID_SPEED_KMH),
    };
  });
};

export const useServiceTelemetry = (dateFrom: string, dateTo: string) => {
  const query = useQuery({
    queryKey: ['service-telemetry', dateFrom, dateTo],
    queryFn: () => fetchServiceTelemetry(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo && dateFrom <= dateTo),
    staleTime: 60 * 1000,
  });

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
