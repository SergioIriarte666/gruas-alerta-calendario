import { Fragment, useState } from 'react';
import { subDays } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOperatorIdleMetrics } from '@/hooks/operatorlocations/useOperatorLocations';
import { useTrackableOperators } from '@/hooks/operators/useTrackableOperators';
import { businessClock } from '@/utils/businessClock';
import { toLocalDateString, safeDateToDisplaySlashes } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';
import type { OperatorIdleDaySummary } from '@/types/operatorLocations';
import {
  STOP_REASON_LABELS,
  isIncidentStopReason,
  isStopEventOverdue,
  stopEventMinutes,
} from '@/types/serviceStopEvent';

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours}h ${mins}min`;
};

interface IdleMetricsPanelProps {
  onViewRoute: (operatorId: string, dateISO: string) => void;
}

export const IdleMetricsPanel = ({ onViewRoute }: IdleMetricsPanelProps) => {
  const [dateFrom, setDateFrom] = useState<string>(() => toLocalDateString(subDays(businessClock.todayDate(), 6)));
  const [dateTo, setDateTo] = useState<string>(() => businessClock.today());
  const [thresholdMinutes, setThresholdMinutes] = useState<number>(30);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { summaries, isLoading, error } = useOperatorIdleMetrics(dateFrom, dateTo, thresholdMinutes);
  const { operators } = useTrackableOperators();
  const trackableOperatorIds = new Set(operators.map((operator) => operator.id));
  const visibleSummaries = summaries.filter((summary) => trackableOperatorIds.has(summary.operatorId));

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Desde</label>
          <DatePickerInput value={dateFrom} onChange={setDateFrom} className="w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Hasta</label>
          <DatePickerInput value={dateTo} onChange={setDateTo} className="w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Umbral de gap (min)</label>
          <Input
            type="number"
            min={1}
            value={thresholdMinutes}
            onChange={(e) => setThresholdMinutes(Math.max(1, Number(e.target.value) || 1))}
            className="w-32"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error instanceof Error ? error.message : 'No se pudieron cargar los tiempos muertos'}
        </p>
      )}

      <div className="resources-panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Operador</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right"># Servicios</TableHead>
              <TableHead className="text-right">Sin horario</TableHead>
              <TableHead className="text-right">Tiempo muerto</TableHead>
              <TableHead className="text-right">Gap mayor</TableHead>
              <TableHead className="text-right">Detenciones declaradas</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Cargando...</TableCell>
              </TableRow>
            )}
            {!isLoading && visibleSummaries.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  No hay gaps sobre el umbral en el rango seleccionado
                </TableCell>
              </TableRow>
            )}
            {visibleSummaries.map((summary: OperatorIdleDaySummary) => {
              const key = `${summary.operatorId}::${summary.date}`;
              const isExpanded = expanded.has(key);
              return (
                <Fragment key={key}>
                  <TableRow className="cursor-pointer" onClick={() => toggleExpanded(key)}>
                    <TableCell>
                      {(summary.gaps.length > 0 || summary.declaredStops.length > 0)
                        && (isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}
                    </TableCell>
                    <TableCell>{summary.operatorName}</TableCell>
                    <TableCell>{safeDateToDisplaySlashes(summary.date)}</TableCell>
                    <TableCell className="text-right">{summary.serviceCount}</TableCell>
                    <TableCell className="text-right">{summary.servicesWithoutSchedule || '—'}</TableCell>
                    <TableCell className="text-right">{formatMinutes(summary.totalIdleMinutes)}</TableCell>
                    <TableCell className="text-right">{formatMinutes(summary.largestGapMinutes)}</TableCell>
                    {/* Detención declarada = parada con motivo. Sin esta columna,
                        un almuerzo y un hueco inexplicado se ven igual. */}
                    <TableCell className="text-right">
                      {summary.declaredStops.length === 0 ? '—' : (
                        <span className={cn('font-medium', summary.overdueStopCount > 0 && 'text-warning')}>
                          {summary.declaredStops.length} · {formatMinutes(summary.declaredStopMinutes)}
                          {summary.overdueStopCount > 0 && ` · ${summary.overdueStopCount} sobre lo típico`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1 text-xs text-info hover:bg-info/10 hover:text-info"
                        onClick={() => onViewRoute(summary.operatorId, summary.date)}
                      >
                        Ver ruta
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && summary.gaps.map((gap, index) => (
                    <TableRow key={`${key}-gap-${index}`} className="bg-muted/40">
                      <TableCell />
                      <TableCell colSpan={7} className="text-xs text-muted-foreground">
                        Entre folio {gap.fromFolio} terminado {gap.fromEndTime} y folio {gap.toFolio} iniciado {gap.toStartTime}
                        {' '}— {formatMinutes(gap.minutes)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                  {isExpanded && summary.declaredStops.map((event) => {
                    const minutes = stopEventMinutes(event, businessClock.now());
                    const overdue = isStopEventOverdue(event.reason, minutes);
                    // Incidente (ruta cortada / falla mecánica): no tiene
                    // duración típica contra la cual alertar, así que se
                    // distingue por lo que es, no por cuánto duró.
                    const incident = isIncidentStopReason(event.reason);
                    return (
                      <TableRow key={`${key}-stop-${event.id}`} className="bg-muted/40">
                        <TableCell />
                        <TableCell
                          colSpan={7}
                          className={cn(
                            'text-xs',
                            incident ? 'text-danger' : overdue ? 'text-warning' : 'text-muted-foreground',
                          )}
                        >
                          {incident ? 'Incidente' : 'Detención declarada'} · {STOP_REASON_LABELS[event.reason]} · desde{' '}
                          {businessClock.format(event.started_at, 'HH:mm')} — {formatMinutes(minutes)}
                          {overdue && ' (sobre lo típico para este motivo)'}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    );
                  })}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
