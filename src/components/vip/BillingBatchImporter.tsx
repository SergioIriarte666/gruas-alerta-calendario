import { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Layers3,
  Loader2,
  ReceiptText,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import type { Service } from '@/types';
import { useBillingBatchImport } from '@/hooks/vip/useBillingBatchImport';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BillingBatchImporterProps {
  clientId: string;
  clientName: string;
  services: Service[];
  onServiceSelect: (service: Service) => void;
  onRefresh: () => Promise<unknown> | unknown;
}

const stageClass = (done: boolean, active: boolean) => cn(
  'flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
  done && 'border-success/30 bg-success-soft text-success-text',
  active && 'border-primary/40 bg-primary/10 text-primary',
  !done && !active && 'border-border/70 bg-muted/25 text-muted-foreground',
);

const billingTemplateUrl = `${import.meta.env.BASE_URL}templates/plantilla_facturacion_masiva.xlsx`;

const formatIsoDate = (value?: string): string => {
  if (!value) return 'Sin fecha';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const summarizeDates = (values: Array<string | undefined>): string => {
  const dates = [...new Set(values.filter(Boolean) as string[])].sort();
  if (dates.length === 0) return 'Sin fecha';
  if (dates.length === 1) return formatIsoDate(dates[0]);
  return `${formatIsoDate(dates[0])} – ${formatIsoDate(dates[dates.length - 1])}`;
};

function ServiceLink({
  service,
  clientId,
  onSelect,
}: {
  service: Service;
  clientId: string;
  onSelect: (service: Service) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      className="group/service inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/[0.04] px-2 py-1 font-mono text-xs text-foreground transition hover:border-primary/45 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={`Ver servicio ${service.folio}`}
      title={`Ver servicio ${service.folio} · ${formatIsoDate(service.serviceDate)}`}
    >
      <Eye className="size-3.5 text-primary transition-transform group-hover/service:scale-110" />
      <span className="font-semibold">{service.folio}</span>
      <span className="text-muted-foreground">· {formatCurrency(getDisplayServiceValue(service, clientId))}</span>
    </button>
  );
}

export function BillingBatchImporter({
  clientId,
  clientName,
  services,
  onServiceSelect,
  onRefresh,
}: BillingBatchImporterProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('Servicio de remolque de vehículos');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batch = useBillingBatchImport({ clientId, services, onRefresh });
  const isBusy = batch.busyStage !== null;
  const progressValue = batch.progress && batch.progress.total > 0
    ? Math.round((batch.progress.current / batch.progress.total) * 100)
    : 0;

  const handleFile = async (file?: File) => {
    if (!file) return;
    await batch.processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resultLabel = (assignmentId: string, assignmentStatus: string) => {
    const execution = batch.executions[assignmentId];
    if (execution?.invoiceId) return { label: `Facturada · ${execution.invoiceFolio}`, variant: 'success' as const };
    if (execution?.closureId) return { label: `Cierre ${execution.closureFolio}`, variant: 'info' as const };
    if (batch.ocsApplied) return { label: 'OC aplicada', variant: 'info' as const };
    if (assignmentStatus === 'ready') return { label: 'Lista', variant: 'success' as const };
    return { label: 'Revisar', variant: 'warning' as const };
  };

  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
            <div className="relative overflow-hidden p-5 sm:p-6">
              <div className="absolute inset-y-0 right-0 hidden w-36 bg-[linear-gradient(135deg,transparent_25%,hsl(var(--primary)/0.06)_25%,hsl(var(--primary)/0.06)_50%,transparent_50%,transparent_75%,hsl(var(--primary)/0.06)_75%)] bg-[length:18px_18px] lg:block" />
              <div className="relative flex items-start gap-4">
                <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3 text-primary">
                  <Layers3 className="size-6" />
                </div>
                <div className="min-w-0 space-y-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Proceso asistido</p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">Carga masiva de facturación</h3>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Concilia cotizaciones repetidas por suma de montos y ejecuta el flujo operativo en orden:
                    OC, cierre y factura.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 border-t border-border/70 bg-muted/20 p-5 lg:border-l lg:border-t-0">
              <div className="hidden text-sm text-muted-foreground sm:block">
                <strong className="block text-foreground">Excel o CSV</strong>
                Previsualización sin modificar datos
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" asChild className="w-full gap-2 sm:w-auto">
                  <a href={billingTemplateUrl} download="plantilla_facturacion_masiva.xlsx">
                    <Download className="size-4" />
                    Descargar plantilla
                  </a>
                </Button>
                <Button onClick={() => setOpen(true)} className="w-full gap-2 sm:w-auto">
                  <UploadCloud className="size-4" />
                  Importar lote
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => !isBusy && setOpen(nextOpen)}>
        <DialogContent className="max-w-[96rem] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-5 pr-12">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <ReceiptText className="size-5" />
                </div>
                <div>
                  <DialogTitle>Carga masiva OC → Cierre → Factura</DialogTitle>
                  <DialogDescription className="mt-1">
                    {clientName}. Cada etapa requiere que la anterior termine correctamente.
                  </DialogDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="mr-4 hidden shrink-0 gap-2 sm:flex">
                <a href={billingTemplateUrl} download="plantilla_facturacion_masiva.xlsx">
                  <Download className="size-4" />
                  Plantilla Excel
                </a>
              </Button>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-border/70 px-6 py-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className={stageClass(batch.ocsApplied, batch.busyStage === 'ocs')}>
                  {batch.ocsApplied ? <CheckCircle2 className="size-4 shrink-0" /> : <span className="font-mono text-xs">01</span>}
                  <span className="truncate font-medium">Aplicar OCs</span>
                </div>
                <ArrowRight className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
                <div className={stageClass(batch.closuresComplete, batch.busyStage === 'closures')}>
                  {batch.closuresComplete ? <CheckCircle2 className="size-4 shrink-0" /> : <span className="font-mono text-xs">02</span>}
                  <span className="truncate font-medium">Crear cierres</span>
                </div>
                <ArrowRight className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
                <div className={stageClass(batch.invoicesComplete, batch.busyStage === 'invoices')}>
                  {batch.invoicesComplete ? <CheckCircle2 className="size-4 shrink-0" /> : <span className="font-mono text-xs">03</span>}
                  <span className="truncate font-medium">Crear facturas</span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {batch.rows.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className="group flex min-h-80 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-primary/[0.035] p-8 text-center transition hover:border-primary/60 hover:bg-primary/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {batch.busyStage === 'parsing' ? (
                    <Loader2 className="mb-4 size-10 animate-spin text-primary" />
                  ) : (
                    <FileSpreadsheet className="mb-4 size-12 text-primary transition-transform group-hover:-translate-y-1" />
                  )}
                  <span className="text-lg font-semibold text-foreground">Seleccionar planilla de facturación</span>
                  <span className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Debe contener factura, cotización, OC, fecha de emisión, neto, IVA y total.
                    El vencimiento se calcula a 30 días cuando no viene informado.
                  </span>
                  <span className="mt-5 rounded-full border border-border/70 bg-background px-4 py-2 text-xs font-medium text-foreground">
                    Formatos .xlsx, .xls o .csv
                  </span>
                </button>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Archivo cargado</p>
                      <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                        <FileSpreadsheet className="size-4 text-primary" />
                        {batch.fileName}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={batch.reset} disabled={isBusy} className="gap-2">
                      <RotateCcw className="size-4" />
                      Cambiar archivo
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      ['Cotizaciones', batch.plan.groups.length],
                      ['Facturas', batch.plan.invoiceCount],
                      ['Servicios', batch.plan.serviceCount],
                      ['Neto conciliado', formatCurrency(batch.plan.netTotal)],
                      ['Bloqueos', batch.plan.blockingCount],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  {batch.error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>El proceso requiere atención</AlertTitle>
                      <AlertDescription>{batch.error}</AlertDescription>
                    </Alert>
                  )}

                  {!batch.plan.ready && (
                    <Alert variant="warning">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>No se aplicarán cambios todavía</AlertTitle>
                      <AlertDescription>
                        Corrige las cotizaciones con diferencias o conflictos. La suma de servicios debe cuadrar con la suma neta de sus facturas.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="overflow-hidden rounded-xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/35 hover:bg-muted/35">
                          <TableHead className="w-14 text-center">N°</TableHead>
                          <TableHead>Cotización</TableHead>
                          <TableHead>Fechas servicio</TableHead>
                          <TableHead>Servicios</TableHead>
                          <TableHead className="text-right">Servicios TMS</TableHead>
                          <TableHead className="text-right">Facturas</TableHead>
                          <TableHead className="text-right">Diferencia</TableHead>
                          <TableHead>Resultado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batch.plan.groups.map((group, groupIndex) => (
                          <TableRow key={group.quoteNumber}>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {String(groupIndex + 1).padStart(2, '0')}
                            </TableCell>
                            <TableCell className="font-mono font-semibold">COT-{group.quoteNumber}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {summarizeDates(group.services.map((service) => service.serviceDate))}
                            </TableCell>
                            <TableCell>
                              <div className="flex min-w-64 max-w-lg flex-wrap gap-1.5">
                                {group.services.length > 0
                                  ? group.services.map((service) => (
                                    <ServiceLink
                                      key={service.id}
                                      service={service}
                                      clientId={clientId}
                                      onSelect={onServiceSelect}
                                    />
                                  ))
                                  : <span className="text-xs text-muted-foreground">Sin servicios asociados</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(group.serviceTotal)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(group.invoiceTotal)}</TableCell>
                            <TableCell className={cn('text-right tabular-nums', group.difference !== 0 && 'font-semibold text-danger')}>
                              {formatCurrency(group.difference)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={group.status === 'ready' ? 'success' : 'warning'}>
                                {group.status === 'ready' ? 'Cuadrado' : 'Revisar'}
                              </Badge>
                              {group.message && <p className="mt-1 max-w-md text-xs text-muted-foreground">{group.message}</p>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/70">
                    <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
                      <h4 className="text-sm font-semibold text-foreground">Distribución por factura</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">Cada servicio se usa una sola vez y cada cierre debe sumar exactamente el neto.</p>
                    </div>
                    <div className="max-h-80 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/35 hover:bg-muted/35">
                            <TableHead className="w-14 text-center">N°</TableHead>
                            <TableHead>Factura</TableHead>
                            <TableHead>Fechas factura</TableHead>
                            <TableHead>Cotización</TableHead>
                            <TableHead>OC</TableHead>
                            <TableHead>Servicios asignados</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {batch.plan.assignments.map((assignment, assignmentIndex) => {
                            const result = resultLabel(assignment.row.id, assignment.status);
                            return (
                              <TableRow key={assignment.row.id}>
                                <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                  {String(assignmentIndex + 1).padStart(2, '0')}
                                </TableCell>
                                <TableCell className="font-mono font-semibold">{assignment.row.invoiceNumber}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs">
                                  <span className="block text-foreground">Emite {formatIsoDate(assignment.row.issueDate)}</span>
                                  <span className="mt-0.5 block text-muted-foreground">Vence {formatIsoDate(assignment.row.dueDate)}</span>
                                </TableCell>
                                <TableCell className="font-mono">COT-{assignment.row.quoteNumber}</TableCell>
                                <TableCell className="font-mono">OC-{assignment.row.purchaseOrder}</TableCell>
                                <TableCell>
                                  <div className="flex max-w-md flex-wrap gap-1">
                                    {assignment.services.length > 0
                                      ? assignment.services.map((service) => (
                                        <ServiceLink
                                          key={service.id}
                                          service={service}
                                          clientId={clientId}
                                          onSelect={onServiceSelect}
                                        />
                                      ))
                                      : <span className="text-xs text-muted-foreground">Sin asignación</span>}
                                  </div>
                                  {assignment.message && <p className="mt-1 text-xs text-danger">{assignment.message}</p>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatCurrency(assignment.row.net)}</TableCell>
                                <TableCell><Badge variant={result.variant}>{result.label}</Badge></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {!batch.ocsApplied && (
                    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/15 p-4">
                      <Checkbox
                        id="overwrite-billing-oc"
                        checked={batch.allowPurchaseOrderOverwrite}
                        onCheckedChange={(checked) => batch.setAllowPurchaseOrderOverwrite(checked === true)}
                        disabled={isBusy}
                      />
                      <div>
                        <Label htmlFor="overwrite-billing-oc" className="cursor-pointer text-sm font-medium">
                          Permitir reemplazar OCs diferentes
                        </Label>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Déjalo desactivado para proteger servicios que ya tienen otra orden de compra.
                        </p>
                      </div>
                    </div>
                  )}

                  {batch.closuresComplete && !batch.invoicesComplete && (
                    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-4">
                      <Label htmlFor="billing-description">Descripción para las facturas</Label>
                      <Input
                        id="billing-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        disabled={isBusy}
                        maxLength={500}
                      />
                    </div>
                  )}

                  {batch.progress && (
                    <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                          <span className="truncate">{batch.progress.label}</span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {batch.progress.current}/{batch.progress.total}
                        </span>
                      </div>
                      <Progress value={progressValue} className="h-2" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {batch.rows.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border/70 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {batch.invoicesComplete
                    ? 'Proceso terminado. Los servicios, cierres y facturas quedaron relacionados.'
                    : 'El sistema conserva los avances si una fila falla y permite reintentar la etapa.'}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {!batch.ocsApplied && (
                    <Button onClick={batch.applyPurchaseOrders} disabled={isBusy || !batch.plan.ready} className="gap-2">
                      {batch.busyStage === 'ocs' && <Loader2 className="size-4 animate-spin" />}
                      Aplicar OCs
                    </Button>
                  )}
                  {batch.ocsApplied && !batch.closuresComplete && (
                    <Button onClick={batch.createClosures} disabled={isBusy || !batch.plan.ready} className="gap-2">
                      {batch.busyStage === 'closures' && <Loader2 className="size-4 animate-spin" />}
                      Crear cierres
                    </Button>
                  )}
                  {batch.closuresComplete && !batch.invoicesComplete && (
                    <Button onClick={() => batch.createInvoices(description)} disabled={isBusy || description.trim().length < 10} className="gap-2">
                      {batch.busyStage === 'invoices' && <Loader2 className="size-4 animate-spin" />}
                      Crear facturas
                    </Button>
                  )}
                  {batch.invoicesComplete && (
                    <Button onClick={() => setOpen(false)} className="gap-2">
                      <CheckCircle2 className="size-4" />
                      Finalizar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
