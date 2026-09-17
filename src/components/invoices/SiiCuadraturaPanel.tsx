import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, Download, FileSearch, FileWarning, Info, Loader2, Scale,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SiiRcvImportCard } from '@/components/siircv/SiiRcvImportCard';
import { useUser } from '@/contexts/UserContext';
import { formatCurrency } from '@/lib/utils';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';
import { monthLabel } from '@/utils/ivaF29Utils';
import { docTypeLabel, type CuadraturaInvoiceRef, type CuadraturaMatchRow } from '@/utils/siiCuadratura';
import { exportSiiCuadraturaExcel } from '@/utils/reports/siiCuadraturaExporter';
import { G5N_ENTITY_RUT, useSiiCuadratura } from '@/hooks/siircv/useSiiCuadratura';

const logger = createLogger('SiiCuadraturaPanel');

const YEARS_BACK = 3;

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DISCLAIMER =
  'Reporte de solo lectura: compara el Registro de Ventas del SII (importado desde CSV) contra las ' +
  'facturas del TMS por folio (N° fiscal). No modifica facturas ni estados. Las notas de crédito del ' +
  'RCV se muestran aparte, asociadas al folio que referencian.';

const invoiceStatusMeta: Record<string, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-muted text-foreground' },
  sent: { label: 'Enviada', className: 'bg-info/15 text-info' },
  paid: { label: 'Pagada', className: 'bg-success/15 text-success' },
  overdue: { label: 'Vencida', className: 'bg-danger/15 text-danger' },
  partial: { label: 'Parcial', className: 'bg-warning/15 text-warning' },
  cancelled: { label: 'Anulada', className: 'bg-muted text-muted-foreground' },
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const meta = invoiceStatusMeta[status] ?? { label: status, className: 'bg-muted text-foreground' };
  return <Badge className={`${meta.className} text-xs`}>{meta.label}</Badge>;
}

function SummaryCard({ icon, label, count, amount, tone }: {
  icon: React.ReactNode;
  label: string;
  count: number;
  amount: number;
  tone: 'success' | 'danger' | 'warning' | 'muted';
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
    muted: 'text-muted-foreground',
  };
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <span className={`mt-0.5 shrink-0 ${toneClasses[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{count}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatCurrency(amount)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MatchRowsTable({ rows, showDiff }: { rows: CuadraturaMatchRow[]; showDiff: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio SII</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha SII</TableHead>
            <TableHead>Cliente (SII)</TableHead>
            <TableHead className="text-right">Total SII</TableHead>
            {showDiff && (
              <>
                <TableHead className="text-right">Total TMS</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Estado TMS</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.rcvId}>
              <TableCell className="whitespace-nowrap font-medium">{row.folio}</TableCell>
              <TableCell className="whitespace-nowrap">{docTypeLabel(row.docType)}</TableCell>
              <TableCell className="whitespace-nowrap">{row.docDate}</TableCell>
              <TableCell className="max-w-56 truncate">{row.counterpartName || row.counterpartRut}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{formatCurrency(row.siiTotal)}</TableCell>
              {showDiff && (
                <>
                  <TableCell className="whitespace-nowrap text-right">
                    {row.invoice ? formatCurrency(row.invoice.total) : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold text-danger">
                    {row.diff != null ? formatCurrency(row.diff) : '—'}
                  </TableCell>
                  <TableCell>{row.invoice ? <InvoiceStatusBadge status={row.invoice.status} /> : '—'}</TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TmsSinSiiTable({ invoices }: { invoices: CuadraturaInvoiceRef[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio TMS</TableHead>
            <TableHead>N° Fiscal</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha emisión</TableHead>
            <TableHead className="text-right">Total TMS</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="whitespace-nowrap font-medium">{invoice.folio}</TableCell>
              <TableCell className="whitespace-nowrap">{invoice.numeroFiscal}</TableCell>
              <TableCell className="max-w-56 truncate">{invoice.clientName ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap">{invoice.issueDate}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{formatCurrency(invoice.total)}</TableCell>
              <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SiiCuadraturaPanel() {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  const today = businessClock.today();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [entityRut, setEntityRut] = useState(G5N_ENTITY_RUT);

  const period = `${year}-${String(month).padStart(2, '0')}`;
  const { data, isLoading } = useSiiCuadratura(period);

  const years = useMemo(
    () => Array.from({ length: YEARS_BACK + 1 }, (_, i) => currentYear - i),
    [currentYear],
  );

  const handleExport = async () => {
    if (!data) return;
    try {
      await exportSiiCuadraturaExcel(data);
      toast.success('Cuadratura exportada a Excel.');
    } catch (error) {
      logger.error('Error exportando cuadratura SII', error);
      toast.error('No fue posible exportar la cuadratura.');
    }
  };

  const noCuadraRows = data?.rows.filter((row) => row.categoria === 'monto_no_cuadra') ?? [];
  const siiSinTmsRows = data?.rows.filter((row) => row.categoria === 'sii_sin_tms') ?? [];
  const okRows = data?.rows.filter((row) => row.categoria === 'ok') ?? [];
  const hasRcv = (data?.rows.length ?? 0) + (data?.notasCredito.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40" aria-label="Mes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
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
          Período {monthLabel(period)} · Grúas 5 Norte ({G5N_ENTITY_RUT})
        </span>

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data || !hasRcv}>
            <Download className="mr-2 size-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cuadrando período…
        </div>
      ) : (
        <>
          {!hasRcv && (
            <Card>
              <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
                <FileSearch className="mt-0.5 size-5 shrink-0" />
                <p>
                  No hay registros del RCV de ventas de Grúas 5 Norte para {monthLabel(period)}.
                  {isAdmin
                    ? ' Importa el CSV del Registro de Ventas del SII con el importador de más abajo.'
                    : ' Un administrador debe importar el CSV del Registro de Ventas del SII.'}
                </p>
              </CardContent>
            </Card>
          )}

          {hasRcv && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  icon={<CheckCircle2 className="size-5" />}
                  label="OK (folio y monto cuadran)"
                  count={data.summary.ok.count}
                  amount={data.summary.ok.total}
                  tone="success"
                />
                <SummaryCard
                  icon={<AlertTriangle className="size-5" />}
                  label="Monto no cuadra"
                  count={data.summary.montoNoCuadra.count}
                  amount={data.summary.montoNoCuadra.diff}
                  tone="danger"
                />
                <SummaryCard
                  icon={<FileWarning className="size-5" />}
                  label="SII sin TMS"
                  count={data.summary.siiSinTms.count}
                  amount={data.summary.siiSinTms.total}
                  tone="warning"
                />
                <SummaryCard
                  icon={<Scale className="size-5" />}
                  label="TMS sin SII"
                  count={data.summary.tmsSinSii.count}
                  amount={data.summary.tmsSinSii.total}
                  tone="warning"
                />
              </div>

              {noCuadraRows.length > 0 && (
                <Card className="border-danger/40">
                  <CardHeader>
                    <CardTitle className="text-base text-danger">Monto no cuadra</CardTitle>
                    <CardDescription>
                      El folio existe en ambos lados pero los totales difieren. Diferencia acumulada
                      (SII − TMS): <span className="font-semibold">{formatCurrency(data.summary.montoNoCuadra.diff)}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MatchRowsTable rows={noCuadraRows} showDiff />
                  </CardContent>
                </Card>
              )}

              {siiSinTmsRows.length > 0 && (
                <Card className="border-warning/40">
                  <CardHeader>
                    <CardTitle className="text-base">SII sin TMS</CardTitle>
                    <CardDescription>
                      Documentos del Registro de Ventas del SII sin factura con ese N° fiscal en el TMS.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MatchRowsTable rows={siiSinTmsRows} showDiff={false} />
                  </CardContent>
                </Card>
              )}

              {data.tmsSinSii.length > 0 && (
                <Card className="border-warning/40">
                  <CardHeader>
                    <CardTitle className="text-base">TMS sin SII</CardTitle>
                    <CardDescription>
                      Facturas vigentes emitidas en el período cuyo N° fiscal no aparece en el RCV importado
                      (se excluyen las anuladas).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TmsSinSiiTable invoices={data.tmsSinSii} />
                  </CardContent>
                </Card>
              )}

              {data.notasCredito.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notas de crédito del RCV</CardTitle>
                    <CardDescription>
                      Informativo, no cuentan como descuadre. Se asocian al folio que referencian cuando el CSV lo trae.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Folio NC</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cliente (SII)</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Factura TMS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.notasCredito.map((nc) => (
                          <TableRow key={nc.rcvId}>
                            <TableCell className="whitespace-nowrap font-medium">{nc.folio}</TableCell>
                            <TableCell className="whitespace-nowrap">{nc.docDate}</TableCell>
                            <TableCell className="max-w-56 truncate">{nc.counterpartName || nc.counterpartRut}</TableCell>
                            <TableCell className="whitespace-nowrap text-right">{formatCurrency(nc.siiTotal)}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {nc.refFolio != null ? `Folio ${nc.refFolio}` : 'Sin referencia en el CSV'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {nc.refInvoice
                                ? `${nc.refInvoice.folio} · ${nc.refInvoice.clientName ?? ''}`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {okRows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">OK — {okRows.length} documento(s) cuadrado(s)</CardTitle>
                    <CardDescription>
                      Folio y monto coinciden entre SII y TMS por {formatCurrency(data.summary.ok.total)} en total.
                      El detalle completo va en el Excel.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              {data.sinNumeroFiscal > 0 && (
                <p className="text-xs text-muted-foreground">
                  {data.sinNumeroFiscal} factura(s) vigente(s) del período sin N° fiscal registrado:
                  no son cuadrables contra el SII hasta que se les asigne el folio.
                </p>
              )}
            </>
          )}

          {isAdmin && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Importar Registro de Ventas del SII (Grúas 5 Norte)
              </h3>
              <SiiRcvImportCard entityRut={entityRut} onEntityRutChange={setEntityRut} />
            </div>
          )}

          <p className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>{DISCLAIMER}</span>
          </p>
        </>
      )}
    </div>
  );
}
