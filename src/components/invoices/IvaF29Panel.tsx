import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { CalendarClock, FileText, Info, Loader2, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppPagination } from '@/components/shared/AppPagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUser } from '@/contexts/UserContext';
import { formatCurrency } from '@/lib/utils';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';
import { addMonths, monthLabel } from '@/utils/ivaF29Utils';
import { useIvaF29Fetcher } from '@/hooks/ivaF29/useIvaF29Fetcher';
import { useIvaF29Separation } from '@/hooks/ivaF29/useIvaF29Separation';
import type { IvaF29InvoiceRow, IvaF29MonthSummary } from '@/types/ivaF29';

const logger = createLogger('IvaF29');

const ITEMS_PER_PAGE = 10;
/** Nº de años hacia atrás disponibles en el selector. */
const YEARS_BACK = 3;

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DISCLAIMER =
  'Estimación de IVA débito fiscal (F29) sobre las facturas de clientes emitidas en el mes, ' +
  'excluyendo anuladas. No incluye IVA crédito, PPM ni remanente de meses anteriores. ' +
  'El F29 real declarado por el contador puede diferir.';

const statusMeta: Record<string, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-muted text-foreground' },
  sent: { label: 'Enviada', className: 'bg-info/15 text-info' },
  paid: { label: 'Pagada', className: 'bg-success/15 text-success' },
  overdue: { label: 'Vencida', className: 'bg-danger/15 text-danger' },
  partial: { label: 'Parcial', className: 'bg-warning/15 text-warning' },
  cancelled: { label: 'Anulada', className: 'bg-muted text-muted-foreground' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, className: 'bg-muted text-foreground' };
  return <Badge className={`${meta.className} text-xs`}>{meta.label}</Badge>;
}

function SummaryCards({ summary, period }: { summary: IvaF29MonthSummary; period: string }) {
  const declaracionMonth = monthLabel(addMonths(period, 1));
  const cobradoPct = summary.ivaDebito > 0 ? Math.round((summary.ivaCobrado / summary.ivaDebito) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <Receipt className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Ventas netas del mes</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(summary.ventasNetas)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/50 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-5">
          <TrendingUp className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">IVA débito fiscal (a pagar)</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-primary">
              {formatCurrency(summary.ivaDebito)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <Wallet className="mt-0.5 size-5 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">IVA de facturas ya cobradas</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-success">
              {formatCurrency(summary.ivaCobrado)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {cobradoPct}% del IVA débito ya debería estar apartado
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Facturas del mes</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{summary.count}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="size-3" />
              Pago estimado a declarar en {declaracionMonth}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonChart({ comparison }: { comparison: IvaF29MonthSummary[] }) {
  const data = comparison.map((m) => ({
    mes: monthLabel(m.month).replace(/ \d{4}$/, ''),
    ivaDebito: m.ivaDebito,
    ivaCobrado: m.ivaCobrado,
  }));

  const chartConfig = {
    ivaDebito: { label: 'IVA débito', color: 'hsl(var(--primary))' },
    ivaCobrado: { label: 'IVA cobrado', color: 'hsl(var(--success))' },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comparativo últimos 6 meses</CardTitle>
        <CardDescription>IVA débito fiscal vs. IVA de facturas ya cobradas</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="mes" className="text-xs" tick={{ fill: 'hsl(var(--foreground))' }} />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                width={56}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value, name) => [formatCurrency(Number(value)), name]} />
                }
              />
              <Bar dataKey="ivaDebito" fill="var(--color-ivaDebito)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ivaCobrado" fill="var(--color-ivaCobrado)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface DetailProps {
  rows: IvaF29InvoiceRow[];
  canEdit: boolean;
  pendingId: string | null;
  onToggle: (row: IvaF29InvoiceRow, separated: boolean) => void;
}

/** Clase de resaltado para filas cuyo IVA ya fue apartado. */
const SEPARATED_ROW = 'bg-success/10 hover:bg-success/15';

function DetailTable({ rows, canEdit, pendingId, onToggle }: DetailProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24 text-center">IVA apartado</TableHead>
            <TableHead>N° Fiscal</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Neto</TableHead>
            <TableHead className="text-right">IVA</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={row.ivaSeparated ? SEPARATED_ROW : undefined}>
              <TableCell className="text-center">
                <Checkbox
                  checked={row.ivaSeparated}
                  disabled={!canEdit || pendingId === row.id}
                  onCheckedChange={(checked) => onToggle(row, checked === true)}
                  aria-label={`Marcar IVA apartado de ${row.numeroFiscal || row.folio}`}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium">{row.numeroFiscal || row.folio}</TableCell>
              <TableCell className="max-w-56 truncate">{row.clientName}</TableCell>
              <TableCell className="whitespace-nowrap">{row.issueDate}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{formatCurrency(row.neto)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium">{formatCurrency(row.iva)}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{formatCurrency(row.total)}</TableCell>
              <TableCell><StatusBadge status={row.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailCards({ rows, canEdit, pendingId, onToggle }: DetailProps) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.id} className={row.ivaSeparated ? 'border-success/40 bg-success/10' : undefined}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{row.numeroFiscal || row.folio}</span>
              <StatusBadge status={row.status} />
            </div>
            <p className="truncate text-sm text-muted-foreground">{row.clientName}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="text-right">{row.issueDate}</dd>
              <dt className="text-muted-foreground">Neto</dt>
              <dd className="text-right">{formatCurrency(row.neto)}</dd>
              <dt className="text-muted-foreground">IVA</dt>
              <dd className="text-right font-medium">{formatCurrency(row.iva)}</dd>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-right">{formatCurrency(row.total)}</dd>
            </dl>
            <label className="flex items-center gap-2 border-t border-border/60 pt-2 text-sm">
              <Checkbox
                checked={row.ivaSeparated}
                disabled={!canEdit || pendingId === row.id}
                onCheckedChange={(checked) => onToggle(row, checked === true)}
                aria-label={`Marcar IVA apartado de ${row.numeroFiscal || row.folio}`}
              />
              <span className={row.ivaSeparated ? 'font-medium text-success' : 'text-muted-foreground'}>
                IVA apartado para F29
              </span>
            </label>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function IvaF29Panel() {
  const isMobile = useIsMobile();
  const { user } = useUser();
  const canEdit = user?.role === 'admin' || user?.role === 'operator';
  const today = businessClock.today(); // 'YYYY-MM-DD' del día comercial
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [page, setPage] = useState(1);

  const period = `${year}-${String(month).padStart(2, '0')}`;
  const { data, isLoading } = useIvaF29Fetcher(period);
  const separation = useIvaF29Separation();
  const pendingId = separation.isPending ? (separation.variables?.invoiceId ?? null) : null;

  const handleToggleSeparated = (row: IvaF29InvoiceRow, separated: boolean) => {
    separation.mutate(
      { invoiceId: row.id, separated },
      {
        onSuccess: () =>
          toast.success(
            separated
              ? `IVA de ${row.numeroFiscal || row.folio} marcado como apartado`
              : `Se quitó la marca de IVA apartado de ${row.numeroFiscal || row.folio}`,
          ),
        onError: () => toast.error('No se pudo actualizar la marca de IVA apartado'),
      },
    );
  };

  const years = useMemo(
    () => Array.from({ length: YEARS_BACK + 1 }, (_, i) => currentYear - i),
    [currentYear],
  );

  const detailRows = data?.invoices ?? [];
  const totalPages = Math.max(1, Math.ceil(detailRows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = detailRows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handlePeriodChange = (nextYear: number, nextMonth: number) => {
    setYear(nextYear);
    setMonth(nextMonth);
    setPage(1);
    logger.debug('Período IVA F29 cambiado', { period: `${nextYear}-${nextMonth}` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(month)} onValueChange={(v) => handlePeriodChange(year, Number(v))}>
          <SelectTrigger className="w-40" aria-label="Mes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(v) => handlePeriodChange(Number(v), month)}>
          <SelectTrigger className="w-28" aria-label="Año">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          Período {monthLabel(period)}
        </span>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Calculando IVA…
        </div>
      ) : (
        <>
          <SummaryCards summary={data.summary} period={period} />

          <ComparisonChart comparison={data.comparison} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle de facturas del período</CardTitle>
              <CardDescription>{monthLabel(period)} · {data.summary.count} factura(s) vigente(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailRows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay facturas vigentes emitidas en {monthLabel(period)}.
                </p>
              ) : (
                <>
                  {isMobile ? (
                    <DetailCards rows={pagedRows} canEdit={canEdit} pendingId={pendingId} onToggle={handleToggleSeparated} />
                  ) : (
                    <DetailTable rows={pagedRows} canEdit={canEdit} pendingId={pendingId} onToggle={handleToggleSeparated} />
                  )}
                  <AppPagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
                </>
              )}
            </CardContent>
          </Card>

          <p className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>{DISCLAIMER}</span>
          </p>
        </>
      )}
    </div>
  );
}
