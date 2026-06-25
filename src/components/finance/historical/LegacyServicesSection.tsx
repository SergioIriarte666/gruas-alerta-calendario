import { useEffect, useMemo, useState } from 'react';
import { type ColumnDef, flexRender, getCoreRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, Check, ChevronDown, ChevronUp, ChevronsUpDown, CircleDollarSign, Download, Edit3, FileArchive, Info, Loader2, Search, ShieldCheck, Trash2, Upload, UsersRound, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import DateRangePicker from '@/components/closures/DateRangePicker';
import { EditLegacyServiceModal } from './EditLegacyServiceModal';
import { LegacyServicesImportDialog } from '@/components/finance/historical/LegacyServicesImportDialog';
import { AppPagination } from '@/components/shared/AppPagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/contexts/UserContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DEFAULT_LEGACY_SERVICES_SORT,
  fetchAllLegacyServices,
  type LegacyServiceRecord,
  type LegacyServicesFilters,
  type LegacyServicesSort,
  type LegacyServicesSortColumn,
  useDeleteLegacyImport,
  useLegacyFilterOptions,
  useLegacyImportsList,
  useLegacyServicesAnalytics,
  useLegacyServicesList,
} from '@/hooks/useLegacyServicesQuery';
import { useDismissibleNotice } from '@/hooks/useDismissibleNotice';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';

const logger = createLogger('LegacyServicesTable');
// Subir esta versión cuando el texto del banner cambie y se quiera
// forzar su reaparición a todos los usuarios.
const LEGACY_BANNER_KEY = 'legacy_services_intro_banner';
const LEGACY_BANNER_VERSION = 'v1';
const PIE_COLORS = ['#d97706', '#0f766e', '#2563eb', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#c2410c', '#64748b'];
const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);

function MultiFilter({ label, values, selected, onChange }: { label: string; values: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between font-normal"><span className="truncate">{selected.length ? `${label} (${selected.length})` : label}</span><ChevronDown className="ml-2 size-4 opacity-50" /></Button></PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start"><ScrollArea className="h-64"><div className="space-y-1">{values.map((value) => <button type="button" key={value} onClick={() => toggle(value)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"><Checkbox checked={selected.includes(value)} /><span className="min-w-0 flex-1 truncate">{value}</span>{selected.includes(value) && <Check className="size-3 text-amber-600" />}</button>)}</div></ScrollArea>{selected.length > 0 && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}>Limpiar selección</Button>}</PopoverContent>
    </Popover>
  );
}

function KpiCard({ title, value, caption, icon: Icon }: { title: string; value: string; caption: string; icon: typeof BarChart3 }) {
  return <Card className="overflow-hidden border-border/70"><CardContent className="relative p-5"><div className="absolute -right-3 -top-3 size-20 rounded-full bg-amber-500/10" /><div className="mb-4 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p><Icon className="size-5 text-amber-600" /></div><p className="truncate text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{caption}</p></CardContent></Card>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="border-border/70"><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="h-72 pt-2">{children}</CardContent></Card>;
}

function HeaderTooltip({ label, description }: { label?: string; description: string }) {
  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-full text-muted-foreground transition-colors hover:text-amber-600" aria-label={label ? `Información sobre ${label}` : 'Más información'}>
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs leading-relaxed">
          {description}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="size-4 text-primary" />;
  if (sorted === 'desc') return <ChevronDown className="size-4 text-primary" />;
  return <ChevronsUpDown className="size-4 opacity-40" />;
}

function SortableHeader({
  column,
  label,
  description,
}: {
  column: any;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => column.toggleSorting()}
        className="-ml-4 h-8 gap-1 px-2 font-semibold hover:bg-transparent hover:text-primary"
      >
        <span>{label}</span>
        <SortIcon sorted={column.getIsSorted()} />
      </Button>
      {description ? <HeaderTooltip label={label} description={description} /> : null}
    </div>
  );
}

export function LegacyServicesSection() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const [importOpen, setImportOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const { isDismissed: bannerDismissed, isLoading: loadingBannerDismiss, dismiss: dismissBanner, restore: restoreBanner } = useDismissibleNotice(LEGACY_BANNER_KEY, LEGACY_BANNER_VERSION);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [insurers, setInsurers] = useState<string[]>([]);
  const [operators, setOperators] = useState<string[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: DEFAULT_LEGACY_SERVICES_SORT.column, desc: DEFAULT_LEGACY_SERVICES_SORT.direction === 'desc' },
  ]);

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(searchInput); setPage(1); }, 400); return () => window.clearTimeout(timer); }, [searchInput]);
  const filters = useMemo<LegacyServicesFilters>(() => ({ dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined, dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined, insurers, operators, serviceTypes, search, page, limit: 50 }), [dateFrom, dateTo, insurers, operators, serviceTypes, search, page]);
  const sortBy = useMemo<LegacyServicesSort>(() => {
    const currentSort = sorting[0];
    if (!currentSort) return DEFAULT_LEGACY_SERVICES_SORT;
    return {
      column: currentSort.id as LegacyServicesSortColumn,
      direction: currentSort.desc ? 'desc' : 'asc',
    };
  }, [sorting]);
  const { data: list, isLoading: listLoading } = useLegacyServicesList(filters, sortBy);
  const { data: analytics, isLoading: analyticsLoading } = useLegacyServicesAnalytics(filters);
  const { data: options } = useLegacyFilterOptions();
  const { data: imports } = useLegacyImportsList();
  const deleteImport = useDeleteLegacyImport();
  const columns = useMemo<ColumnDef<LegacyServiceRecord>[]>(() => {
    const baseColumns: ColumnDef<LegacyServiceRecord>[] = [
      {
        accessorKey: 'received_at',
        enableSorting: true,
        header: ({ column }) => <SortableHeader column={column} label="Fecha/hora de recepción" />,
        cell: ({ row }) => <span className="whitespace-nowrap">{formatForDisplayWithTime(row.original.received_at)}</span>,
      },
      {
        accessorKey: 'manual_folio',
        enableSorting: true,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            label="Folio sistema antiguo"
            description="Consecutivo interno asignado por la plataforma de membresía anterior. Identifica la fila pero no tiene valor operacional."
          />
        ),
        cell: ({ row }) => row.original.manual_folio || '—',
      },
      {
        accessorKey: 'expediente',
        enableSorting: true,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            label="N° Siniestro / Expediente"
            description="Número del siniestro asignado por la aseguradora cliente. Solo presente cuando aplica."
          />
        ),
        cell: ({ row }) => row.original.expediente || '—',
      },
      {
        accessorKey: 'insurer',
        enableSorting: true,
        header: ({ column }) => <SortableHeader column={column} label="Aseguradora" />,
        cell: ({ row }) => row.original.insurer || '—',
      },
      {
        accessorKey: 'service_type',
        enableSorting: true,
        header: ({ column }) => <SortableHeader column={column} label="Tipo de servicio" />,
        cell: ({ row }) => row.original.service_type || '—',
      },
      {
        accessorKey: 'vehicle_brand',
        enableSorting: true,
        header: ({ column }) => <SortableHeader column={column} label="Marca del vehículo" />,
        cell: ({ row }) => (
          <div>
            <p>{row.original.vehicle_brand || '—'}</p>
            <p className="text-xs text-muted-foreground">{row.original.vehicle_type || '—'}</p>
          </div>
        ),
      },
      {
        accessorKey: 'license_plate',
        enableSorting: true,
        header: ({ column }) => <SortableHeader column={column} label="Placas del vehículo" />,
        cell: ({ row }) => <span className="font-mono font-semibold">{row.original.license_plate || '—'}</span>,
      },
      {
        accessorKey: 'vin',
        enableSorting: false,
        header: 'VIN',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.vin || '—'}</span>,
      },
      {
        id: 'route',
        enableSorting: false,
        header: 'Origen → Destino',
        cell: ({ row }) => (
          <div className="max-w-72">
            <p className="truncate">{row.original.origin || '—'}</p>
            <p className="truncate text-xs text-muted-foreground">→ {row.original.destination || '—'}</p>
          </div>
        ),
      },
      {
        accessorKey: 'crane_label',
        enableSorting: true,
        header: ({ column }) => <SortableHeader column={column} label="Grúa" />,
        cell: ({ row }) => row.original.crane_label || '—',
      },
      {
        accessorKey: 'operator_label',
        enableSorting: true,
        header: ({ column }) => <SortableHeader column={column} label="Operador" />,
        cell: ({ row }) => row.original.operator_label || '—',
      },
      {
        accessorKey: 'total_clp',
        enableSorting: true,
        header: ({ column }) => <SortableHeader column={column} label="Total" />,
        cell: ({ row }) => <span className="whitespace-nowrap font-medium">{formatCLP(row.original.total_clp)}</span>,
      },
      {
        accessorKey: 'observations',
        enableSorting: false,
        header: 'Observaciones',
        cell: ({ row }) => <p className="max-w-72 truncate" title={row.original.observations || undefined}>{row.original.observations || '—'}</p>,
      },
    ];

    if (!isAdmin) return baseColumns;

    return [
      ...baseColumns,
      {
        id: 'actions',
        enableSorting: false,
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`Editar servicio legacy ${row.original.manual_folio || row.original.id}`}
              onClick={() => setEditingServiceId(row.original.id)}
            >
              <Edit3 className="size-4 text-amber-600" />
            </Button>
          </div>
        ),
      },
    ];
  }, [isAdmin]);
  const table = useReactTable({
    data: list?.rows ?? [],
    columns,
    state: { sorting },
    manualSorting: true,
    onSortingChange: (updater) => {
      setSorting((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        return next.length
          ? next
          : [{ id: DEFAULT_LEGACY_SERVICES_SORT.column, desc: DEFAULT_LEGACY_SERVICES_SORT.direction === 'desc' }];
      });
      setPage(1);
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const clearFilters = () => { setDateFrom(undefined); setDateTo(undefined); setInsurers([]); setOperators([]); setServiceTypes([]); setSearchInput(''); setSearch(''); setPage(1); };
  const updateFilter = (setter: (value: string[]) => void) => (value: string[]) => { setter(value); setPage(1); };
  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllLegacyServices({ ...filters, page: undefined, limit: undefined }, sortBy);
      const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ Fecha: formatForDisplayWithTime(row.received_at), Folio: row.manual_folio, Expediente: row.expediente, Aseguradora: row.insurer, 'Tipo de servicio': row.service_type, Marca: row.vehicle_brand, 'Tipo de vehículo': row.vehicle_type, Placa: row.license_plate, VIN: row.vin, Origen: row.origin, Destino: row.destination, Grúa: row.crane_label, Operador: row.operator_label, Total: row.total_clp, Observaciones: row.observations })));
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Servicios Legacy');
      XLSX.writeFile(workbook, `servicios_legacy_${businessClock.today()}.xlsx`);
      toast.success(`${rows.length} registros exportados.`);
    } catch (error) {
      logger.error('No fue posible exportar servicios legacy', error);
      toast.error(error instanceof Error ? error.message : 'No fue posible exportar.');
    } finally { setExporting(false); }
  };

  const byMonth = analytics?.byMonth ?? [];
  const chartHeight = isMobile ? 230 : 260;
  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {!bannerDismissed && !loadingBannerDismiss && (
          <Alert className="relative flex-1 border-amber-500/30 bg-amber-500/5 pr-10">
            <FileArchive className="size-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-400">
              Servicios Legacy (pre-TMS, 2020-2025) · Archivo operativo independiente
            </AlertTitle>
            <Collapsible open={bannerOpen} onOpenChange={setBannerOpen}>
              <CollapsibleTrigger asChild>
                <button type="button" className="mt-1 flex items-center gap-1 text-xs text-amber-700 underline dark:text-amber-400">
                  <ChevronDown className={`size-3 transition-transform ${bannerOpen ? 'rotate-180' : ''}`} />
                  {bannerOpen ? 'Ocultar detalle' : 'Ver detalle'}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <AlertDescription className="mt-2 text-sm">
                  Respaldos importados desde la plataforma de membresía anterior. Solo lectura. No vinculados a servicios, clientes, operadores ni grúas actuales. Para cargar datos nuevos, descarga la plantilla desde el botón Importar XLSX. El sistema también acepta el archivo original "ReporteMemoriasDescriptivas" sin reformatear.
                </AlertDescription>
              </CollapsibleContent>
            </Collapsible>
            <button
              type="button"
              onClick={() => dismissBanner()}
              aria-label="Ocultar este aviso permanentemente"
              className="absolute right-2 top-2 rounded-md p-1 transition hover:bg-amber-500/10"
            >
              <X className="size-4 text-amber-700" />
            </button>
          </Alert>
        )}
        <Button onClick={() => setImportOpen(true)} className="shrink-0 bg-amber-600 text-white hover:bg-amber-700"><Upload className="mr-2 size-4" />Importar XLSX</Button>
      </div>

      <Card><CardHeader><CardTitle className="text-base">Filtros del archivo</CardTitle></CardHeader><CardContent className="space-y-4"><DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={(value) => { setDateFrom(value); setPage(1); }} onDateToChange={(value) => { setDateTo(value); setPage(1); }} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><MultiFilter label="Aseguradora" values={options?.insurers ?? []} selected={insurers} onChange={updateFilter(setInsurers)} /><MultiFilter label="Operador" values={options?.operators ?? []} selected={operators} onChange={updateFilter(setOperators)} /><MultiFilter label="Tipo de servicio" values={options?.serviceTypes ?? []} selected={serviceTypes} onChange={updateFilter(setServiceTypes)} /><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" placeholder="Buscar por folio, expediente, placa, origen o destino..." /></div></div><div className="flex justify-end"><Button variant="ghost" onClick={clearFilters}>Limpiar filtros</Button></div></CardContent></Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{(list?.totalCount ?? 0).toLocaleString('es-CL')}</span> servicios en el período filtrado</p>
        {bannerDismissed && (
          <button
            type="button"
            onClick={() => restoreBanner()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Info className="size-3" />
            Mostrar info del archivo
          </button>
        )}
      </div>

      <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Listado de servicios</CardTitle><Button variant="outline" onClick={exportExcel} disabled={exporting}><Download className="mr-2 size-4" />{exporting ? 'Exportando…' : 'Exportar Excel'}</Button></CardHeader><CardContent className="p-0">{listLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="size-7 animate-spin" /></div> : <div className="overflow-x-auto"><Table className="min-w-[1200px]"><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">No hay servicios para estos filtros.</TableCell></TableRow>}</TableBody></Table></div>}<AppPagination className="border-t py-4" currentPage={page} totalPages={list?.pageCount ?? 1} onPageChange={setPage} /></CardContent></Card>

      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between rounded-md border border-border/70 bg-card p-3 transition hover:bg-accent/40">
            <span className="flex items-center gap-2 text-sm font-medium"><BarChart3 className="size-4" />Resumen del período</span>
            <ChevronDown className={`size-4 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {summaryOpen && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard title="Servicios" value={(analytics?.kpis.total_count ?? 0).toLocaleString('es-CL')} caption="en el período filtrado" icon={BarChart3} /><KpiCard title="Total acumulado" value={formatCLP(analytics?.kpis.total_clp ?? 0)} caption="CLP acumulado" icon={CircleDollarSign} /><KpiCard title="Promedio" value={formatCLP(analytics?.kpis.avg_clp ?? 0)} caption="por servicio" icon={UsersRound} /><KpiCard title="Aseguradora #1" value={analytics?.kpis.top_insurer_name ?? 'Sin datos'} caption={`${(analytics?.kpis.top_insurer_pct ?? 0).toFixed(1)}% de los servicios`} icon={ShieldCheck} /></div>}

          {summaryOpen && (analyticsLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="size-8 animate-spin text-amber-600" /></div> : <div className="grid gap-4 xl:grid-cols-2"><div className="space-y-4"><ChartCard title="Servicios por mes"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><ChartTooltip /><Bar dataKey="count" name="Servicios" fill="#d97706" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Distribución por aseguradora"><ResponsiveContainer width="100%" height={chartHeight}><PieChart><Pie data={analytics?.byInsurer ?? []} dataKey="count" nameKey="name" innerRadius={52} outerRadius={85} paddingAngle={2}>{(analytics?.byInsurer ?? []).map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><ChartTooltip /></PieChart></ResponsiveContainer></ChartCard><ChartCard title="Top 10 operadores"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={analytics?.byOperator ?? []} layout="vertical" margin={{ left: 25 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={isMobile ? 80 : 130} fontSize={10} tick={{ width: 120 }} /><ChartTooltip /><Bar dataKey="count" name="Servicios" fill="#0f766e" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard></div><div className="space-y-4"><ChartCard title="Total CLP por mes"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={11} /><YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1_000_000)}M`} fontSize={11} /><ChartTooltip formatter={(value) => formatCLP(Number(value))} /><Bar dataKey="total_clp" name="Total" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Distribución por tipo de servicio"><ResponsiveContainer width="100%" height={chartHeight}><PieChart><Pie data={analytics?.byServiceType ?? []} dataKey="count" nameKey="name" innerRadius={52} outerRadius={85} paddingAngle={2}>{(analytics?.byServiceType ?? []).map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><ChartTooltip /></PieChart></ResponsiveContainer></ChartCard><ChartCard title="Top 10 grúas / recursos"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={analytics?.byCrane ?? []} layout="vertical" margin={{ left: 25 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={isMobile ? 80 : 130} fontSize={10} /><ChartTooltip /><Bar dataKey="count" name="Servicios" fill="#9333ea" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard></div></div>)}
        </CollapsibleContent>
      </Collapsible>

      <Card><CardHeader><CardTitle>Lotes importados</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Archivo</TableHead><TableHead>Importado</TableHead><TableHead>Filas</TableHead><TableHead>Período</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{imports?.length ? imports.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.filename}</TableCell><TableCell>{formatForDisplayWithTime(item.created_at)}</TableCell><TableCell>{item.inserted_rows}/{item.total_rows}{item.skipped_rows ? <span className="ml-1 text-xs text-muted-foreground">({item.skipped_rows} omitidas)</span> : null}</TableCell><TableCell>{item.period_from ?? '—'} — {item.period_to ?? '—'}</TableCell><TableCell className="text-right"><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Eliminar lote ${item.filename}`}><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar este lote?</AlertDialogTitle><AlertDialogDescription>Se eliminarán el lote “{item.filename}” y todos sus servicios legacy asociados. Esta acción no afecta los servicios actuales.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteImport.mutate(item.id, { onSuccess: () => toast.success('Lote eliminado.'), onError: (error) => toast.error(error.message) })}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Aún no hay importaciones.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>

      <LegacyServicesImportDialog open={importOpen} onOpenChange={setImportOpen} onImportComplete={() => setPage(1)} />
      <EditLegacyServiceModal
        open={!!editingServiceId}
        onOpenChange={(open: boolean) => { if (!open) setEditingServiceId(null); }}
        serviceId={editingServiceId}
        onSaved={async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['legacy-services-list'] }),
            queryClient.invalidateQueries({ queryKey: ['legacy-services-analytics'] }),
            queryClient.invalidateQueries({ queryKey: ['legacy-imports-list'] }),
            queryClient.invalidateQueries({ queryKey: ['legacy-filter-options'] }),
          ]);
        }}
      />
    </div>
    </TooltipProvider>
  );
}
