import { useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import {
  AlertTriangle,
  Download,
  Gauge,
  RefreshCw,
  Route,
  Search,
  Truck,
} from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  summarizeSpeedSamples,
  useServiceTelemetry,
  type ServiceTelemetryRecord,
} from '@/hooks/operatorlocations/useServiceTelemetry';
import { businessClock } from '@/utils/businessClock';
import { downloadTextFile } from '@/utils/fileDownload';
import { safeDateToDisplaySlashes, toLocalDateString } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';

const DEFAULT_SPEED_LIMIT_KMH = 80;
const ALL_VALUE = '__all__';

interface ServiceTelemetryPanelProps {
  onViewRoute: (operatorId: string, dateISO: string) => void;
}

const formatNumber = (value: number | null, digits = 0): string => (
  value === null
    ? '—'
    : new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)
);

const formatDuration = (minutes: number | null): string => {
  if (minutes === null) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}min` : `${rest} min`;
};

const csvCell = (value: string | number | null) => (
  `"${String(value ?? '').replaceAll('"', '""')}"`
);

export const ServiceTelemetryPanel = ({ onViewRoute }: ServiceTelemetryPanelProps) => {
  const [dateFrom, setDateFrom] = useState(() => toLocalDateString(subDays(businessClock.todayDate(), 6)));
  const [dateTo, setDateTo] = useState(() => businessClock.today());
  const [operatorId, setOperatorId] = useState(ALL_VALUE);
  const [craneId, setCraneId] = useState(ALL_VALUE);
  const [search, setSearch] = useState('');
  const [speedLimitKmh, setSpeedLimitKmh] = useState(DEFAULT_SPEED_LIMIT_KMH);
  const { records, isLoading, error, refetch } = useServiceTelemetry(dateFrom, dateTo);

  const operatorOptions = useMemo(() => (
    Array.from(new Map(
      records
        .filter((record) => record.operatorId)
        .map((record) => [record.operatorId as string, record.operatorName]),
    ))
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  ), [records]);

  const craneOptions = useMemo(() => (
    Array.from(new Map(
      records
        .filter((record) => record.craneId)
        .map((record) => [record.craneId as string, record.craneLabel]),
    ))
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  ), [records]);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es');

    return records
      .filter((record) => operatorId === ALL_VALUE || record.operatorId === operatorId)
      .filter((record) => craneId === ALL_VALUE || record.craneId === craneId)
      .filter((record) => (
        !normalizedSearch
        || record.folio.toLocaleLowerCase('es').includes(normalizedSearch)
        || record.operatorName.toLocaleLowerCase('es').includes(normalizedSearch)
        || record.craneLabel.toLocaleLowerCase('es').includes(normalizedSearch)
      ))
      .map((record) => ({
        ...record,
        speed: summarizeSpeedSamples(record.speedSamplesKmh, speedLimitKmh),
      }));
  }, [craneId, operatorId, records, search, speedLimitKmh]);

  const summary = useMemo(() => {
    const withTelemetry = rows.filter((row) => row.speed.samplesCount > 0);
    const maxSpeed = withTelemetry.reduce<number | null>((current, row) => {
      const value = row.speed.maxSpeedKmh;
      if (value === null) return current;
      return current === null ? value : Math.max(current, value);
    }, null);

    return {
      serviceCount: rows.length,
      withTelemetryCount: withTelemetry.length,
      totalDistanceKm: rows.reduce((sum, row) => sum + (row.totalDistanceKm ?? 0), 0),
      overLimitSamples: rows.reduce((sum, row) => sum + row.speed.overLimitSamples, 0),
      maxSpeed,
    };
  }, [rows]);

  const exportCsv = () => {
    const header = [
      'Fecha servicio',
      'Folio',
      'Grúa',
      'Operador',
      'Inicio GPS',
      'Fin GPS',
      'Duración',
      'Distancia km',
      'Promedio en movimiento km/h',
      'Percentil 95 km/h',
      'Máxima km/h',
      `Muestras sobre ${speedLimitKmh} km/h`,
      'Puntos GPS',
      'Calidad',
    ];
    const lines = rows.map((row) => [
      row.serviceDate,
      row.folio,
      row.craneLabel,
      row.operatorName,
      row.startAt ? businessClock.format(row.startAt, 'HH:mm') : '',
      row.endAt ? businessClock.format(row.endAt, 'HH:mm') : '',
      formatDuration(row.totalDurationMinutes),
      row.totalDistanceKm,
      row.speed.averageMovingSpeedKmh === null ? '' : Math.round(row.speed.averageMovingSpeedKmh),
      row.speed.percentile95SpeedKmh === null ? '' : Math.round(row.speed.percentile95SpeedKmh),
      row.speed.maxSpeedKmh === null ? '' : Math.round(row.speed.maxSpeedKmh),
      row.speed.overLimitSamples,
      row.gpsPointsCount,
      row.speed.samplesCount === 0 ? 'Sin telemetría' : row.lowConfidence ? 'Revisar' : 'Confiable',
    ]);
    const content = `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(';')).join('\n')}`;

    downloadTextFile({
      content,
      fileName: `telemetria-servicios-${dateFrom}-${dateTo}.csv`,
      contentType: 'text/csv;charset=utf-8',
    });
  };

  return (
    <div className="telemetry-ledger space-y-4">
      <section className="telemetry-ledger__hero">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="telemetry-ledger__eyebrow">
              <Gauge className="size-4" />
              Bitácora GPS
            </p>
            <h2>Telemetría de servicios</h2>
            <p>Velocidades y trazabilidad por fecha, grúa y operador.</p>
          </div>
          <div className="telemetry-ledger__limit">
            <span>Umbral de control</span>
            <strong>{speedLimitKmh}</strong>
            <small>km/h</small>
          </div>
        </div>

        <div className="telemetry-ledger__metrics">
          <div>
            <Truck className="size-4" />
            <span>Servicios</span>
            <strong>{summary.serviceCount}</strong>
            <small>{summary.withTelemetryCount} con telemetría</small>
          </div>
          <div>
            <Route className="size-4" />
            <span>Distancia registrada</span>
            <strong>{formatNumber(summary.totalDistanceKm, 1)}</strong>
            <small>kilómetros GPS</small>
          </div>
          <div>
            <Gauge className="size-4" />
            <span>Máxima observada</span>
            <strong>{formatNumber(summary.maxSpeed)}</strong>
            <small>km/h</small>
          </div>
          <div className={cn(summary.overLimitSamples > 0 && 'is-alert')}>
            <AlertTriangle className="size-4" />
            <span>Sobre el umbral</span>
            <strong>{summary.overLimitSamples}</strong>
            <small>muestras GPS</small>
          </div>
        </div>
      </section>

      <section className="resources-panel p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[11rem_11rem_minmax(11rem,1fr)_minmax(12rem,1fr)_9rem_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Desde</label>
            <DatePickerInput value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Hasta</label>
            <DatePickerInput value={dateTo} onChange={setDateTo} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Operador</label>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos los operadores</SelectItem>
                {operatorOptions.map((operator) => (
                  <SelectItem key={operator.id} value={operator.id}>{operator.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Grúa</label>
            <Select value={craneId} onValueChange={setCraneId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todas las grúas</SelectItem>
                {craneOptions.map((crane) => (
                  <SelectItem key={crane.id} value={crane.id}>{crane.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="speed-threshold" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Umbral km/h
            </label>
            <Input
              id="speed-threshold"
              type="number"
              min={10}
              max={150}
              value={speedLimitKmh}
              onChange={(event) => setSpeedLimitKmh(
                Math.min(150, Math.max(10, Number(event.target.value) || DEFAULT_SPEED_LIMIT_KMH)),
              )}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => void refetch()} aria-label="Actualizar telemetría">
              <RefreshCw className={cn('size-4', isLoading && 'animate-spin')} />
            </Button>
            <Button type="button" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4" />
              CSV
            </Button>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por folio, patente, grúa u operador"
            className="pl-9"
          />
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error instanceof Error ? error.message : 'No se pudo cargar la telemetría'}
        </p>
      )}

      <section className="resources-panel overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[73.75rem]">
            <TableHeader className="telemetry-ledger__table-head">
              <TableRow>
                <TableHead>Fecha servicio</TableHead>
                <TableHead className="min-w-48">Servicio</TableHead>
                <TableHead>Grúa</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Ventana GPS</TableHead>
                <TableHead className="text-right">Distancia</TableHead>
                <TableHead className="text-right">Prom. movimiento</TableHead>
                <TableHead className="text-right">P95</TableHead>
                <TableHead className="text-right">Máx. GPS registrada</TableHead>
                <TableHead className="text-right">&gt; {speedLimitKmh}</TableHead>
                <TableHead>Calidad</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                    Cargando telemetría de servicios…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                    No hay servicios para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.map((row) => (
                <TelemetryRow
                  key={row.serviceId}
                  row={row}
                  onViewRoute={onViewRoute}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          “Prom. movimiento” excluye velocidades menores a 5 km/h. “Máx. GPS registrada” es la mayor muestra que el teléfono
          alcanzó a guardar y puede diferir del tablero del vehículo. Lecturas superiores a 150 km/h se descartan como saltos GPS.
          El umbral es una referencia operativa configurable, no una determinación automática de infracción.
        </p>
      </section>
    </div>
  );
};

interface TelemetryRowProps {
  row: ServiceTelemetryRecord & {
    speed: ReturnType<typeof summarizeSpeedSamples>;
  };
  onViewRoute: (operatorId: string, dateISO: string) => void;
}

const TelemetryRow = ({ row, onViewRoute }: TelemetryRowProps) => {
  const hasAlert = row.speed.overLimitSamples > 0;
  const hasTelemetry = row.speed.samplesCount > 0;

  return (
    <TableRow className={cn('telemetry-ledger__row', hasAlert && 'is-alert')}>
      <TableCell className="font-semibold">{safeDateToDisplaySlashes(row.serviceDate)}</TableCell>
      <TableCell className="min-w-48">
        <span className="whitespace-nowrap font-bold text-foreground">{row.folio}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatDuration(row.totalDurationMinutes)} · {row.gpsPointsCount} puntos
        </span>
      </TableCell>
      <TableCell className="max-w-52">
        <span className="block truncate font-medium">{row.craneLabel}</span>
      </TableCell>
      <TableCell>{row.operatorName}</TableCell>
      <TableCell className="tabular-nums">
        {row.startAt ? businessClock.format(row.startAt, 'HH:mm') : '—'}
        {' → '}
        {row.endAt ? businessClock.format(row.endAt, 'HH:mm') : '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.totalDistanceKm === null ? '—' : `${formatNumber(row.totalDistanceKm, 1)} km`}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {row.speed.averageMovingSpeedKmh === null
          ? '—'
          : `${formatNumber(row.speed.averageMovingSpeedKmh)} km/h`}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.speed.percentile95SpeedKmh === null
          ? '—'
          : `${formatNumber(row.speed.percentile95SpeedKmh)} km/h`}
      </TableCell>
      <TableCell className={cn('text-right font-bold tabular-nums', hasAlert && 'text-warning')}>
        {row.speed.maxSpeedKmh === null ? '—' : `${formatNumber(row.speed.maxSpeedKmh)} km/h`}
      </TableCell>
      <TableCell className="text-right">
        <Badge
          variant="outline"
          className={cn(
            'min-w-10 justify-center tabular-nums',
            hasAlert
              ? 'border-warning/35 bg-warning/10 text-warning'
              : 'border-success/30 bg-success/10 text-success',
          )}
        >
          {row.speed.overLimitSamples}
        </Badge>
      </TableCell>
      <TableCell>
        {!hasTelemetry ? (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">Sin GPS</Badge>
        ) : row.lowConfidence || row.gapsCount > 3 ? (
          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Revisar</Badge>
        ) : (
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Confiable</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!row.operatorId}
          onClick={() => row.operatorId && onViewRoute(row.operatorId, row.serviceDate)}
          className="text-info hover:bg-info/10 hover:text-info"
        >
          Ver ruta
        </Button>
      </TableCell>
    </TableRow>
  );
};
