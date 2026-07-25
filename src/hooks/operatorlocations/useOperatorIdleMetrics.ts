import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';
import type { OperatorIdleDaySummary, OperatorIdleGap, OperatorIdleService } from '@/types/operatorLocations';
import { isStopEventOverdue, stopEventMinutes, type ServiceStopEvent } from '@/types/serviceStopEvent';

const logger = createLogger('useOperatorIdleMetrics');
const DEFAULT_THRESHOLD_MINUTES = 30;

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const fetchIdleServices = async (
  dateFromISO: string,
  dateToISO: string,
): Promise<{
  services: OperatorIdleService[];
  operatorNames: Map<string, string>;
  stopEvents: ServiceStopEvent[];
}> => {
  const [servicesResult, operatorsResult, stopEventsResult] = await Promise.all([
    supabase
      .from('services')
      .select('id, operator_id, service_date, start_time, end_time, folio, status')
      .gte('service_date', dateFromISO)
      .lte('service_date', dateToISO)
      .not('operator_id', 'is', null)
      .neq('status', 'cancelled'),
    supabase.from('operators').select('id, name'),
    supabase
      .from('service_stop_events')
      .select('id, service_id, operator_id, reason, note, started_at, ended_at, ended_by_source')
      .gte('started_at', `${dateFromISO}T00:00:00`)
      .lte('started_at', `${dateToISO}T23:59:59.999`),
  ]);

  if (servicesResult.error) {
    throw new Error(servicesResult.error.message || 'No se pudieron cargar los servicios');
  }
  if (operatorsResult.error) {
    throw new Error(operatorsResult.error.message || 'No se pudieron cargar los operadores');
  }
  // Las detenciones enriquecen la vista; sin ellas los tiempos muertos siguen
  // siendo correctos, solo pierden la distinción declarada/sin declarar.
  if (stopEventsResult.error) {
    logger.warn('No se pudieron cargar las detenciones declaradas', stopEventsResult.error);
  }

  const operatorNames = new Map<string, string>();
  for (const op of operatorsResult.data ?? []) {
    operatorNames.set(op.id, op.name);
  }

  return {
    services: (servicesResult.data ?? []) as OperatorIdleService[],
    operatorNames,
    stopEvents: (stopEventsResult.data ?? []) as ServiceStopEvent[],
  };
};

const computeIdleSummaries = (
  services: OperatorIdleService[],
  operatorNames: Map<string, string>,
  thresholdMinutes: number,
  stopEvents: ServiceStopEvent[],
): OperatorIdleDaySummary[] => {
  const groups = new Map<string, OperatorIdleService[]>();

  for (const service of services) {
    const key = `${service.operator_id}::${service.service_date}`;
    const group = groups.get(key) ?? [];
    group.push(service);
    groups.set(key, group);
  }

  // Detención declarada = parada CON motivo. Es lo que separa un hueco
  // justificado (combustible, comida) de uno que nadie explicó.
  const now = businessClock.now();
  const stopsByOperatorDay = new Map<string, ServiceStopEvent[]>();
  for (const event of stopEvents) {
    if (!event.operator_id) continue;
    const day = businessClock.format(event.started_at, 'yyyy-MM-dd');
    const key = `${event.operator_id}::${day}`;
    const bucket = stopsByOperatorDay.get(key) ?? [];
    bucket.push(event);
    stopsByOperatorDay.set(key, bucket);
  }

  const summaries: OperatorIdleDaySummary[] = [];

  for (const [key, group] of groups.entries()) {
    const [operatorId, date] = key.split('::');
    const scheduled = group.filter((s) => s.start_time && s.end_time);
    const servicesWithoutSchedule = group.length - scheduled.length;

    scheduled.sort((a, b) => timeToMinutes(a.start_time as string) - timeToMinutes(b.start_time as string));

    const gaps: OperatorIdleGap[] = [];
    for (let i = 1; i < scheduled.length; i += 1) {
      const prev = scheduled[i - 1];
      const cur = scheduled[i];
      const prevEndMinutes = timeToMinutes(prev.end_time as string);
      const curStartMinutes = timeToMinutes(cur.start_time as string);
      const gapMinutes = curStartMinutes - prevEndMinutes;

      if (gapMinutes >= thresholdMinutes) {
        gaps.push({
          operatorId,
          date,
          fromFolio: prev.folio,
          fromEndTime: prev.end_time as string,
          toFolio: cur.folio,
          toStartTime: cur.start_time as string,
          minutes: gapMinutes,
        });
      }
    }

    const totalIdleMinutes = gaps.reduce((sum, gap) => sum + gap.minutes, 0);
    const largestGapMinutes = gaps.reduce((max, gap) => Math.max(max, gap.minutes), 0);

    const declaredStops = stopsByOperatorDay.get(key) ?? [];
    const declaredStopMinutes = declaredStops.reduce(
      (sum, event) => sum + stopEventMinutes(event, now),
      0,
    );
    const overdueStopCount = declaredStops.filter(
      (event) => isStopEventOverdue(event.reason, stopEventMinutes(event, now)),
    ).length;

    summaries.push({
      operatorId,
      operatorName: operatorNames.get(operatorId) ?? 'Operador',
      date,
      serviceCount: group.length,
      servicesWithoutSchedule,
      totalIdleMinutes,
      largestGapMinutes,
      gaps,
      declaredStops,
      declaredStopMinutes,
      overdueStopCount,
    });
  }

  return summaries.sort((a, b) => (a.date === b.date ? a.operatorName.localeCompare(b.operatorName) : a.date.localeCompare(b.date)));
};

export const useOperatorIdleMetrics = (
  dateFromISO: string | null,
  dateToISO: string | null,
  thresholdMinutes: number = DEFAULT_THRESHOLD_MINUTES,
) => {
  const query = useQuery({
    queryKey: ['operator-idle-metrics', dateFromISO, dateToISO],
    queryFn: () => fetchIdleServices(dateFromISO as string, dateToISO as string),
    enabled: Boolean(dateFromISO && dateToISO),
  });

  const summaries = useMemo(
    () => (query.data
      ? computeIdleSummaries(query.data.services, query.data.operatorNames, thresholdMinutes, query.data.stopEvents)
      : []),
    [query.data, thresholdMinutes],
  );

  return {
    summaries,
    isLoading: query.isLoading,
    error: query.error,
  };
};
