import { useEffect, useMemo, useState } from 'react';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { format } from 'date-fns';
import { BarChart3, Check, ChevronDown, CircleDollarSign, Download, FileArchive, Loader2, Search, ShieldCheck, Trash2, Upload, UsersRound } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import DateRangePicker from '@/components/closures/DateRangePicker';
import { LegacyServicesImportDialog } from '@/components/finance/historical/LegacyServicesImportDialog';
import { AppPagination } from '@/components/shared/AppPagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  fetchAllLegacyServices,
  type LegacyServiceRecord,
  type LegacyServicesFilters,
  useDeleteLegacyImport,
  useLegacyFilterOptions,
  useLegacyImportsList,
  useLegacyServicesAnalytics,
  useLegacyServicesList,
} from '@/hooks/useLegacyServicesQuery';
import { businessClock } from '@/utils/businessClock';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';

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

const columns: ColumnDef<LegacyServiceRecord>[] = [
  { accessorKey: 'received_at', header: 'Fecha', cell: ({ row }) => <span className="whitespace-nowrap">{formatForDisplayWithTime(row.original.received_at)}</span> },
  { accessorKey: 'manual_folio', header: 'Folio', cell: ({ row }) => row.original.manual_folio || '—' },
  { accessorKey: 'insurer', header: 'Aseguradora', cell: ({ row }) => row.original.insurer || '—' },
  { accessorKey: 'service_type', header: 'Tipo', cell: ({ row }) => row.original.service_type || '—' },
  { id: 'vehicle', header: 'Vehículo', cell: ({ row }) => <div><p>{row.original.vehicle_brand || '—'}</p><p className="text-xs text-muted-foreground">{row.original.vehicle_type || '—'}</p></div> },
  { accessorKey: 'license_plate', header: 'Placa', cell: ({ row }) => <span className="font-mono font-semibold">{row.original.license_plate || '—'}</span> },
  { id: 'route', header: 'Origen → Destino', cell: ({ row }) => <div className="max-w-72"><p className="truncate">{row.original.origin || '—'}</p><p className="truncate text-xs text-muted-foreground">→ {row.original.destination || '—'}</p></div> },
  { accessorKey: 'crane_label', header: 'Grúa', cell: ({ row }) => row.original.crane_label || '—' },
  { accessorKey: 'operator_label', header: 'Operador', cell: ({ row }) => row.original.operator_label || '—' },
  { accessorKey: 'subtotal_clp', header: 'Subtotal', cell: ({ row }) => <span className="whitespace-nowrap font-medium">{formatCLP(row.original.subtotal_clp)}</span> },
  { accessorKey: 'total_clp', header: 'Total', cell: ({ row }) => <span className="whitespace-nowrap">{formatCLP(row.original.total_clp)}</span> },
];

export function LegacyServicesSection() {
  const isMobile = useIsMobile();
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [insurers, setInsurers] = useState<string[]>([]);
  const [operators, setOperators] = useState<string[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(searchInput); setPage(1); }, 400); return () => window.clearTimeout(timer); }, [searchInput]);
  const filters = useMemo<LegacyServicesFilters>(() => ({ dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined, dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined, insurers, operators, serviceTypes, search, page, limit: 50 }), [dateFrom, dateTo, insurers, operators, serviceTypes, search, page]);
  const { data: list, isLoading: listLoading } = useLegacyServicesList(filters);
  const { data: analytics, isLoading: analyticsLoading } = useLegacyServicesAnalytics(filters);
  const { data: options } = useLegacyFilterOptions();
  const { data: imports } = useLegacyImportsList();
  const deleteImport = useDeleteLegacyImport();
  const table = useReactTable({ data: list?.rows ?? [], columns, getCoreRowModel: getCoreRowModel() });

  const clearFilters = () => { setDateFrom(undefined); setDateTo(undefined); setInsurers([]); setOperators([]); setServiceTypes([]); setSearchInput(''); setSearch(''); setPage(1); };
  const updateFilter = (setter: (value: string[]) => void) => (value: string[]) => { setter(value); setPage(1); };
  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllLegacyServices(filters);
      const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ Fecha: formatForDisplayWithTime(row.received_at), Folio: row.manual_folio, Aseguradora: row.insurer, 'Tipo de servicio': row.service_type, Marca: row.vehicle_brand, Vehículo: row.vehicle_type, Placa: row.license_plate, VIN: row.vin, Origen: row.origin, Destino: row.destination, Grúa: row.crane_label, Operador: row.operator_label, Subtotal: row.subtotal_clp, Total: row.total_clp, Observaciones: row.observations })));
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Servicios Legacy');
      XLSX.writeFile(workbook, `servicios_legacy_${businessClock.today()}.xlsx`);
      toast.success(`${rows.length} registros exportados.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No fue posible exportar.'); } finally { setExporting(false); }
  };

  const byMonth = analytics?.byMonth ?? [];
  const chartHeight = isMobile ? 230 : 260;
  return (
    <div className="space-y-6 pt-2">
      <section className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-50 via-background to-background p-6 dark:from-amber-950/20">
        <div className="absolute right-0 top-0 h-full w-1 bg-amber-500" /><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start"><div className="max-w-3xl"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400"><FileArchive className="size-4" /> Archivo operativo independiente</div><h2 className="text-2xl font-bold tracking-tight">Servicios Legacy (pre-TMS, 2020-2025)</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Respaldos importados desde la plataforma de membresía anterior. Solo lectura. No vinculados a servicios, clientes, operadores ni grúas actuales del sistema.</p></div><Button onClick={() => setImportOpen(true)} className="shrink-0 bg-amber-600 text-white hover:bg-amber-700"><Upload className="mr-2 size-4" />Importar XLSX</Button></div>
      </section>

      <Card><CardHeader><CardTitle className="text-base">Filtros del archivo</CardTitle></CardHeader><CardContent className="space-y-4"><DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={(value) => { setDateFrom(value); setPage(1); }} onDateToChange={(value) => { setDateTo(value); setPage(1); }} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><MultiFilter label="Aseguradora" values={options?.insurers ?? []} selected={insurers} onChange={updateFilter(setInsurers)} /><MultiFilter label="Operador" values={options?.operators ?? []} selected={operators} onChange={updateFilter(setOperators)} /><MultiFilter label="Tipo de servicio" values={options?.serviceTypes ?? []} selected={serviceTypes} onChange={updateFilter(setServiceTypes)} /><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" placeholder="Placa, folio, origen…" /></div></div><div className="flex justify-end"><Button variant="ghost" onClick={clearFilters}>Limpiar filtros</Button></div></CardContent></Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard title="Servicios" value={(analytics?.kpis.total_count ?? 0).toLocaleString('es-CL')} caption="en el período filtrado" icon={BarChart3} /><KpiCard title="Subtotal" value={formatCLP(analytics?.kpis.total_subtotal_clp ?? 0)} caption="acumulado sin IVA" icon={CircleDollarSign} /><KpiCard title="Promedio" value={formatCLP(analytics?.kpis.avg_clp ?? 0)} caption="por servicio" icon={UsersRound} /><KpiCard title="Aseguradora #1" value={analytics?.kpis.top_insurer_name ?? 'Sin datos'} caption={`${(analytics?.kpis.top_insurer_pct ?? 0).toFixed(1)}% de los servicios`} icon={ShieldCheck} /></div>

      {analyticsLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="size-8 animate-spin text-amber-600" /></div> : <div className="grid gap-4 xl:grid-cols-2"><div className="space-y-4"><ChartCard title="Servicios por mes"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="count" name="Servicios" fill="#d97706" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Distribución por aseguradora"><ResponsiveContainer width="100%" height={chartHeight}><PieChart><Pie data={analytics?.byInsurer ?? []} dataKey="count" nameKey="name" innerRadius={52} outerRadius={85} paddingAngle={2}>{(analytics?.byInsurer ?? []).map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></ChartCard><ChartCard title="Top 10 operadores"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={analytics?.byOperator ?? []} layout="vertical" margin={{ left: 25 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={isMobile ? 80 : 130} fontSize={10} tick={{ width: 120 }} /><Tooltip /><Bar dataKey="count" name="Servicios" fill="#0f766e" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard></div><div className="space-y-4"><ChartCard title="Subtotal CLP por mes"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={11} /><YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1_000_000)}M`} fontSize={11} /><Tooltip formatter={(value) => formatCLP(Number(value))} /><Bar dataKey="subtotal_clp" name="Subtotal" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Distribución por tipo de servicio"><ResponsiveContainer width="100%" height={chartHeight}><PieChart><Pie data={analytics?.byServiceType ?? []} dataKey="count" nameKey="name" innerRadius={52} outerRadius={85} paddingAngle={2}>{(analytics?.byServiceType ?? []).map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></ChartCard><ChartCard title="Top 10 grúas / recursos"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={analytics?.byCrane ?? []} layout="vertical" margin={{ left: 25 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={isMobile ? 80 : 130} fontSize={10} /><Tooltip /><Bar dataKey="count" name="Servicios" fill="#9333ea" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard></div></div>}

      <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Listado de servicios</CardTitle><p className="mt-1 text-sm text-muted-foreground">{(list?.totalCount ?? 0).toLocaleString('es-CL')} registros encontrados</p></div><Button variant="outline" onClick={exportExcel} disabled={exporting}><Download className="mr-2 size-4" />{exporting ? 'Exportando…' : 'Exportar Excel'}</Button></CardHeader><CardContent className="p-0">{listLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="size-7 animate-spin" /></div> : <div className="overflow-x-auto"><Table className="min-w-[1200px]"><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">No hay servicios para estos filtros.</TableCell></TableRow>}</TableBody></Table></div>}<AppPagination className="border-t py-4" currentPage={page} totalPages={list?.pageCount ?? 1} onPageChange={setPage} /></CardContent></Card>

      <Card><CardHeader><CardTitle>Lotes importados</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Archivo</TableHead><TableHead>Importado</TableHead><TableHead>Filas</TableHead><TableHead>Período</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{imports?.length ? imports.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.filename}</TableCell><TableCell>{formatForDisplayWithTime(item.created_at)}</TableCell><TableCell>{item.inserted_rows}/{item.total_rows}{item.skipped_rows ? <span className="ml-1 text-xs text-muted-foreground">({item.skipped_rows} omitidas)</span> : null}</TableCell><TableCell>{item.period_from ?? '—'} — {item.period_to ?? '—'}</TableCell><TableCell className="text-right"><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Eliminar lote ${item.filename}`}><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar este lote?</AlertDialogTitle><AlertDialogDescription>Se eliminarán el lote “{item.filename}” y todos sus servicios legacy asociados. Esta acción no afecta los servicios actuales.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteImport.mutate(item.id, { onSuccess: () => toast.success('Lote eliminado.'), onError: (error) => toast.error(error.message) })}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Aún no hay importaciones.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>

      <LegacyServicesImportDialog open={importOpen} onOpenChange={setImportOpen} onImportComplete={() => setPage(1)} />
    </div>
  );
}
