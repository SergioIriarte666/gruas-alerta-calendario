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
  useServiceTelemetry,
  type ServiceTelemetryRecord,
  type TelemetryCoverageStatus,
} from '@/hooks/operatorlocations/useServiceTelemetry';
import { useDebounce } from '@/hooks/useDebounce';
import { businessClock } from '@/utils/businessClock';
import { downloadTextFile } from '@/utils/fileDownload';
import { getServiceStatusLabel } from '@/utils/statusHelpers';
import { safeDateToDisplaySlashes, toLocalDateString } from '@/utils/timezoneUtils';
import {
  TELEMETRY_MODE_OPTIONS,
  getTelemetryModeLabel,
} from '@/utils/telemetryMode';
import { cn } from '@/lib/utils';

const DEFAULT_SPEED_LIMIT_KMH = 80;
const ALL_VALUE = '__all__';

const COVERAGE_OPTIONS: Array<{
  value: TelemetryCoverageStatus;
  label: string;
}> = [
  { value: 'reliable', label: 'Confiable' },
  { value: 'review', label: 'Revisar' },
  { value: 'missing', label: 'Sin GPS' },
  { value: 'not_started', label: 'No iniciado' },
  { value: 'external', label: 'Externo' },
  { value: 'unexpected', label: 'GPS no esperado' },
];

interface ServiceTelemetryPanelProps {
  onViewRoute: (
    operatorId: string,
    dateISO: string,
    serviceId: string,
    serviceFolio: string,
  ) => void;
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

const getCoverageLabel = (status: TelemetryCoverageStatus): string => (
  COVERAGE_OPTIONS.find((option) => option.value === status)?.label ?? status
);

const getCoverageBadgeClass = (status: TelemetryCoverageStatus): string => {
  switch (status) {
    case 'reliable':
      return 'border-success/30 bg-success/10 text-success';
    case 'review':
    case 'missing':
      return 'border-warning/30 bg-warning/10 text-warning';
    case 'unexpected':
      return 'border-danger/30 bg-danger/10 text-danger';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
};

export const ServiceTelemetryPanel = ({ onViewRoute }: ServiceTelemetryPanelProps) => {
  const [dateFrom, setDateFrom] = useState(() => toLocalDateString(subDays(businessClock.todayDate(), 6)));
  const [dateTo, setDateTo] = useState(() => businessClock.today());
  const [operatorId, setOperatorId] = useState(ALL_VALUE);
  const [craneId, setCraneId] = useState(ALL_VALUE);
  const [serviceType, setServiceType] = useState(ALL_VALUE);
  const [serviceStatus, setServiceStatus] = useState(ALL_VALUE);
  const [telemetryMode, setTelemetryMode] = useState(ALL_VALUE);
  const [coverageStatus, setCoverageStatus] = useState(ALL_VALUE);
  const [search, setSearch] = useState('');
  const [speedLimitKmh, setSpeedLimitKmh] = useState(DEFAULT_SPEED_LIMIT_KMH);
  const debouncedSpeedLimitKmh = useDebounce(speedLimitKmh, 500);
  const { records, isLoading, error, refetch } = useServiceTelemetry(
    dateFrom,
    dateTo,
    debouncedSpeedLimitKmh,
  );

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

  const serviceTypeOptions = useMemo(() => (
    Array.from(new Set(records.map((record) => record.serviceTypeName)))
      .sort((a, b) => a.localeCompare(b, 'es'))
  ), [records]);

  const serviceStatusOptions = useMemo(() => (
    Array.from(new Set(records.map((record) => record.serviceStatus)))
      .sort((a, b) => getServiceStatusLabel(a).localeCompare(getServiceStatusLabel(b), 'es'))
  ), [records]);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es');

    return records
      .filter((record) => operatorId === ALL_VALUE || record.operatorId === operatorId)
      .filter((record) => craneId === ALL_VALUE || record.craneId === craneId)
      .filter((record) => serviceType === ALL_VALUE || record.serviceTypeName === serviceType)
      .filter((record) => serviceStatus === ALL_VALUE || record.serviceStatus === serviceStatus)
      .filter((record) => telemetryMode === ALL_VALUE || record.telemetryMode === telemetryMode)
      .filter((record) => coverageStatus === ALL_VALUE || record.coverageStatus === coverageStatus)
      .filter((record) => (
        !normalizedSearch
        || record.folio.toLocaleLowerCase('es').includes(normalizedSearch)
        || record.serviceTypeName.toLocaleLowerCase('es').includes(normalizedSearch)
        || record.operatorName.toLocaleLowerCase('es').includes(normalizedSearch)
        || record.craneLabel.toLocaleLowerCase('es').includes(normalizedSearch)
      ));
  }, [
    coverageStatus,
    craneId,
    operatorId,
    records,
    search,
    serviceStatus,
    serviceType,
    telemetryMode,
  ]);

  const summary = useMemo(() => {
    const expected = rows.filter((row) => row.trackingExpected);
    const covered = expected.filter((row) => row.trustedPointsCount > 0);
    const maxSpeed = expected.reduce<number | null>((current, row) => {
      if (row.maxSpeedKmh === null) return current;
      return current === null ? row.maxSpeedKmh : Math.max(current, row.maxSpeedKmh);
    }, null);

    return {
      expectedCount: expected.length,
      coveredCount: covered.length,
      coveragePercent: expected.length > 0 ? covered.length / expected.length * 100 : null,
      reliableDistanceKm: expected.reduce((sum, row) => sum + row.reliableDistanceKm, 0),
      overLimitEpisodes: expected.reduce((sum, row) => sum + row.overLimitEpisodes, 0),
      incidents: rows.filter((row) => (
        row.coverageStatus === 'missing'
        || row.coverageStatus === 'review'
        || row.coverageStatus === 'unexpected'
      )).length,
      maxSpeed,
    };
  }, [rows]);

  const exportCsv = () => {
    const header = [
      'Fecha servicio',
      'Folio',
      'Tipo de servicio',
      'Estado',
      'Telemetría esperada',
      'Cobertura',
      'Grúa',
      'Operador',
      'Inicio GPS confiable',
      'Fin GPS confiable',
      'Duración',
      'Distancia confiable km',
      'Promedio en movimiento km/h',
      'Percentil 95 en movimiento km/h',
      'Máxima GPS km/h',
      `Episodios sobre ${debouncedSpeedLimitKmh} km/h`,
      'Puntos GPS crudos',
      'Puntos GPS confiables',
      'Brechas',
    ];
    const lines = rows.map((row) => [
      row.serviceDate,
      row.folio,
      row.serviceTypeName,
      getServiceStatusLabel(row.serviceStatus),
      getTelemetryModeLabel(row.telemetryMode),
      getCoverageLabel(row.coverageStatus),
      row.craneLabel,
      row.operatorName,
      row.startAt ? businessClock.format(row.startAt, 'HH:mm') : '',
      row.endAt ? businessClock.format(row.endAt, 'HH:mm') : '',
      formatDuration(row.totalDurationMinutes),
      row.reliableDistanceKm,
      row.averageMovingSpeedKmh === null ? '' : Math.round(row.averageMovingSpeedKmh),
      row.percentile95SpeedKmh === null ? '' : Math.round(row.percentile95SpeedKmh),
      row.maxSpeedKmh === null ? '' : Math.round(row.maxSpeedKmh),
      row.overLimitEpisodes,
      row.rawPointsCount,
      row.trustedPointsCount,
      row.gapsCount,
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
            <p>Solo servicios que deben generar GPS, más anomalías que requieren auditoría.</p>
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
            <span>Servicios iniciados</span>
            <strong>{summary.expectedCount}</strong>
            <small>con GPS esperado</small>
          </div>
          <div className={cn(summary.coveragePercent !== null && summary.coveragePercent < 100 && 'is-alert')}>
            <Gauge className="size-4" />
            <span>Cobertura GPS</span>
            <strong>{summary.coveragePercent === null ? '—' : `${formatNumber(summary.coveragePercent)}%`}</strong>
            <small>{summary.coveredCount} de {summary.expectedCount} con señal confiable</small>
          </div>
          <div>
            <Route className="size-4" />
            <span>Distancia confiable</span>
            <strong>{formatNumber(summary.reliableDistanceKm, 1)}</strong>
            <small>km con precisión ≤ 50 m</small>
          </div>
          <div className={cn((summary.overLimitEpisodes > 0 || summary.incidents > 0) && 'is-alert')}>
            <AlertTriangle className="size-4" />
            <span>Alertas operativas</span>
            <strong>{summary.overLimitEpisodes}</strong>
            <small>
              episodios &gt; {debouncedSpeedLimitKmh} km/h · {summary.incidents} servicios a revisar
              {summary.maxSpeed !== null ? ` · máx. ${formatNumber(summary.maxSpeed)} km/h` : ''}
            </small>
          </div>
        </div>
      </section>

      <section className="resources-panel p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Desde</label>
            <DatePickerInput value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Hasta</label>
            <DatePickerInput value={dateTo} onChange={setDateTo} />
          </div>
          <FilterSelect
            label="Tipo de servicio"
            value={serviceType}
            onValueChange={setServiceType}
            allLabel="Todos los tipos"
            options={serviceTypeOptions.map((value) => ({ value, label: value }))}
          />
          <FilterSelect
            label="Estado"
            value={serviceStatus}
            onValueChange={setServiceStatus}
            allLabel="Todos los estados"
            options={serviceStatusOptions.map((value) => ({
              value,
              label: getServiceStatusLabel(value),
            }))}
          />
          <FilterSelect
            label="Telemetría"
            value={telemetryMode}
            onValueChange={setTelemetryMode}
            allLabel="Todas las modalidades"
            options={TELEMETRY_MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <FilterSelect
            label="Cobertura"
            value={coverageStatus}
            onValueChange={setCoverageStatus}
            allLabel="Todos los resultados"
            options={COVERAGE_OPTIONS}
          />
          <FilterSelect
            label="Operador"
            value={operatorId}
            onValueChange={setOperatorId}
            allLabel="Todos los operadores"
            options={operatorOptions.map((option) => ({ value: option.id, label: option.name }))}
          />
          <FilterSelect
            label="Grúa"
            value={craneId}
            onValueChange={setCraneId}
            allLabel="Todas las grúas"
            options={craneOptions.map((option) => ({ value: option.id, label: option.label }))}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[9rem_minmax(16rem,1fr)_auto]">
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
          <div>
            <label htmlFor="telemetry-search" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="telemetry-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Folio, tipo, patente u operador"
                className="pl-9"
              />
            </div>
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
      </section>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error instanceof Error ? error.message : 'No se pudo cargar la telemetría'}
        </p>
      )}

      <section className="resources-panel overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[102rem]">
            <TableHeader className="telemetry-ledger__table-head">
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="min-w-48">Servicio</TableHead>
                <TableHead>Tipo / modalidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Grúa</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Ventana GPS confiable</TableHead>
                <TableHead className="text-right">Distancia</TableHead>
                <TableHead className="text-right">Prom. movimiento</TableHead>
                <TableHead className="text-right">P95 movimiento</TableHead>
                <TableHead className="text-right">Máx. GPS</TableHead>
                <TableHead className="text-right">Episodios &gt; {debouncedSpeedLimitKmh}</TableHead>
                <TableHead>Cobertura</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={14} className="h-32 text-center text-muted-foreground">
                    Cargando telemetría de servicios…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="h-32 text-center text-muted-foreground">
                    No hay servicios con telemetría esperada o anomalías para estos filtros.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.map((row) => (
                <TelemetryRow
                  key={row.serviceId}
                  row={row}
                  speedLimitKmh={debouncedSpeedLimitKmh}
                  onViewRoute={onViewRoute}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          Cobertura, distancia y velocidades usan solo lecturas dentro de Chile con precisión informada de hasta 50 m.
          El promedio y P95 consideran movimiento desde 5 km/h. Lecturas superiores a 150 km/h se descartan como saltos GPS.
          Los excesos consecutivos se agrupan en episodios, en vez de contar cada muestra como una infracción distinta.
        </p>
      </section>
    </div>
  );
};

interface FilterSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
}

const FilterSelect = ({
  label,
  value,
  onValueChange,
  allLabel,
  options,
}: FilterSelectProps) => (
  <div>
    <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

interface TelemetryRowProps {
  row: ServiceTelemetryRecord;
  speedLimitKmh: number;
  onViewRoute: (
    operatorId: string,
    dateISO: string,
    serviceId: string,
    serviceFolio: string,
  ) => void;
}

const TelemetryRow = ({ row, speedLimitKmh, onViewRoute }: TelemetryRowProps) => {
  const hasAlert = row.overLimitEpisodes > 0;

  return (
    <TableRow className={cn('telemetry-ledger__row', (hasAlert || row.unexpectedTelemetry) && 'is-alert')}>
      <TableCell className="font-semibold">{safeDateToDisplaySlashes(row.serviceDate)}</TableCell>
      <TableCell className="min-w-48">
        <span className="whitespace-nowrap font-bold text-foreground">{row.folio}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatDuration(row.totalDurationMinutes)} · {row.trustedPointsCount}/{row.rawPointsCount} puntos confiables
        </span>
      </TableCell>
      <TableCell>
        <span className="block font-medium">{row.serviceTypeName}</span>
        <span className="block text-xs text-muted-foreground">
          {getTelemetryModeLabel(row.telemetryMode)}
        </span>
      </TableCell>
      <TableCell>{getServiceStatusLabel(row.serviceStatus)}</TableCell>
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
        {row.trustedPointsCount === 0 ? '—' : `${formatNumber(row.reliableDistanceKm, 1)} km`}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {row.averageMovingSpeedKmh === null
          ? '—'
          : `${formatNumber(row.averageMovingSpeedKmh)} km/h`}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.percentile95SpeedKmh === null
          ? '—'
          : `${formatNumber(row.percentile95SpeedKmh)} km/h`}
      </TableCell>
      <TableCell className={cn('text-right font-bold tabular-nums', hasAlert && 'text-warning')}>
        {row.maxSpeedKmh === null ? '—' : `${formatNumber(row.maxSpeedKmh)} km/h`}
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
          title={`Episodios sobre ${speedLimitKmh} km/h`}
        >
          {row.overLimitEpisodes}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn('whitespace-nowrap', getCoverageBadgeClass(row.coverageStatus))}
        >
          {getCoverageLabel(row.coverageStatus)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!row.operatorId || row.trustedPointsCount === 0}
          onClick={() => row.operatorId && onViewRoute(
            row.operatorId,
            row.serviceDate,
            row.serviceId,
            row.folio,
          )}
          className="text-info hover:bg-info/10 hover:text-info"
        >
          Ver ruta
        </Button>
      </TableCell>
    </TableRow>
  );
};
