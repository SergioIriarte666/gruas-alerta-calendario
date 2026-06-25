import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLegacyServicesImport } from '@/hooks/useLegacyServicesImport';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';
import type { LegacyRow, PreviewStats } from '@/utils/legacyServicesParser';

type Step = 'upload' | 'preview' | 'importing' | 'done';
type ImportResult = { importId: string; inserted: number; skipped: number; errors: string[] };

interface LegacyServicesImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
const formatDate = (value: string | null) => value ? value.split('-').reverse().join('/') : '—';

const MiniRanking = ({ title, items }: { title: string; items: { name: string; count: number }[] }) => (
  <div className="rounded-lg border bg-muted/20 p-3">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <div className="space-y-1.5">
      {items.slice(0, 5).map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate">{item.name}</span><Badge variant="secondary">{item.count}</Badge>
        </div>
      ))}
    </div>
  </div>
);

const NormalizationGroup = ({ title, items }: { title: string; items: { before: string[]; after: string }[] }) => (
  <div className="space-y-2 rounded-lg border bg-background/60 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    {items.length > 0 ? (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item.after}`} className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="font-medium">{item.before.length} variaciones consolidadas en “{item.after}”</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.before.map((value) => `“${value}”`).join(' · ')}
              {' '}
              → {item.after}
            </p>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">Sin variaciones agrupadas para este campo.</p>
    )}
  </div>
);

export function LegacyServicesImportDialog({ open, onOpenChange, onImportComplete }: LegacyServicesImportDialogProps) {
  const { parseFile, runImport, importProgress } = useLegacyServicesImport();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<LegacyRow[]>([]);
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parsing, setParsing] = useState(false);

  const reset = () => {
    setStep('upload'); setFile(null); setRows([]); setStats(null); setNotes(''); setResult(null); setParsing(false);
  };

  const processFile = useCallback(async (selected: File) => {
    setParsing(true);
    try {
      const parsed = await parseFile(selected);
      setFile(selected); setRows(parsed.rows); setStats(parsed.stats); setStep('preview');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible leer el archivo Excel.');
    } finally {
      setParsing(false);
    }
  }, [parseFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
    disabled: parsing,
    onDropAccepted: ([selected]) => selected && processFile(selected),
    onDropRejected: () => toast.error('Seleccione un archivo .xlsx válido.'),
  });

  const confirmImport = async () => {
    if (!file) return;
    setStep('importing');
    try {
      setResult(await runImport(file.name, rows, notes));
      setStep('done');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'La importación no pudo completarse.');
      setStep('preview');
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (step === 'importing') return;
    onOpenChange(nextOpen);
    if (!nextOpen && step !== 'done') reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-amber-600" /> Importar servicios legacy</DialogTitle>
          <DialogDescription>Los datos se guardarán en un archivo histórico aislado, sin modificar servicios ni reportes vigentes.</DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-5 py-3">
            <div {...getRootProps()} className={`group cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${isDragActive ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-muted-foreground/25 hover:border-amber-500/70 hover:bg-muted/30'}`}>
              <input {...getInputProps()} />
              {parsing ? <Loader2 className="mx-auto mb-4 size-10 animate-spin text-amber-600" /> : <Upload className="mx-auto mb-4 size-10 text-muted-foreground transition-colors group-hover:text-amber-600" />}
              <p className="font-semibold">{parsing ? 'Leyendo y validando archivo…' : 'Arrastre aquí el respaldo XLSX'}</p>
              <p className="mt-2 text-sm text-muted-foreground">o haga clic para seleccionarlo</p>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <p>Puede usar la plantilla nueva (hoja “Servicios Legacy”) o el reporte original “ReporteMemoriasDescriptivas” sin reformatear.</p>
              <Button variant="outline" size="sm" className="shrink-0 bg-background/80" asChild>
                <a href="/templates/plantilla_servicios_legacy.xlsx" download="plantilla_servicios_legacy.xlsx">
                  <Download className="mr-2 size-4" />Descargar plantilla
                </a>
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && stats && (
          <div className="space-y-5 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
              <div><p className="font-semibold">{file?.name}</p><p className="text-sm text-muted-foreground">Período {formatDate(stats.period_from)} — {formatDate(stats.period_to)}</p></div>
              <div className="flex gap-2"><Badge className="bg-emerald-600">{stats.valid_rows} válidas</Badge>{stats.invalid_rows > 0 && <Badge variant="destructive">{stats.invalid_rows} inválidas</Badge>}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[['Filas detectadas', stats.total_rows.toLocaleString('es-CL')], ['Filas válidas', stats.valid_rows.toLocaleString('es-CL')], ['Total', formatCLP(stats.total_clp)], ['Filas inválidas', stats.invalid_rows.toLocaleString('es-CL')]].map(([label, value]) => <div key={label} className="rounded-lg border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}
            </div>
            {stats.invalid_rows > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="size-4" /> Fechas no parseables</div><ScrollArea className="h-24"><div className="flex flex-wrap gap-2">{stats.invalid_row_numbers.map((row) => <Badge key={row} variant="outline">Fila {row}: Fecha no parseable</Badge>)}</div></ScrollArea></div>}
            {stats.overlap_stats.total_overlapping > 0 && (
              <Alert variant="warning">
                <AlertTriangle className="size-4" />
                <AlertTitle>Posible solape con importaciones previas</AlertTitle>
                <AlertDescription>
                  <p>
                    Se detectaron {stats.overlap_stats.total_overlapping.toLocaleString('es-CL')} filas con la misma fecha y placa que ya existen en otra importación previa. Esto puede indicar solape entre archivos exportados de distintos rangos. Igual puede continuar — el sistema no bloquea el import.
                  </p>
                  <Accordion type="single" collapsible className="mt-3 rounded-lg border border-amber-200/70 bg-background/60 px-3 dark:border-amber-900/60">
                    <AccordionItem value="overlap-detail" className="border-b-0">
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">Ver detalle de coincidencias</AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {stats.overlap_stats.overlap_samples.map((sample, index) => (
                            <div key={`${sample.received_at}-${sample.license_plate}-${index}`} className="grid gap-1 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr]">
                              <span>{formatForDisplayWithTime(sample.received_at)}</span>
                              <span className="font-mono font-semibold">{sample.license_plate || 'Sin placa'}</span>
                              <span>{sample.manual_folio || 'Sin folio'}</span>
                              <span className="truncate" title={sample.existing_filename}>{sample.existing_filename}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </AlertDescription>
              </Alert>
            )}
            {stats.normalization_applied.total_normalizations > 0 && (
              <Accordion type="single" collapsible className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 dark:border-amber-900 dark:bg-amber-950/20">
                <AccordionItem value="normalization" className="border-b-0">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-left">
                      <Sparkles className="size-4 text-amber-600" />
                      Normalización aplicada ({stats.normalization_applied.total_normalizations} variaciones consolidadas)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <NormalizationGroup title="Operadores unificados" items={stats.normalization_applied.operators_unified} />
                      <NormalizationGroup title="Aseguradoras unificadas" items={stats.normalization_applied.insurers_unified} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
            <div className="grid gap-3 md:grid-cols-3"><MiniRanking title="Top aseguradoras" items={stats.top_insurers} /><MiniRanking title="Top operadores" items={stats.top_operators} /><MiniRanking title="Top tipos de servicio" items={stats.top_service_types} /></div>
            <div className="space-y-2"><Label htmlFor="legacy-notes">Notas del lote (opcional)</Label><Textarea id="legacy-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej.: respaldo septiembre–diciembre 2020" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={reset}>Cancelar</Button><AlertDialog><AlertDialogTrigger asChild><Button className="bg-amber-600 text-white hover:bg-amber-700">Confirmar e importar</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Importar este respaldo?</AlertDialogTitle><AlertDialogDescription>Se importarán {stats.valid_rows} filas válidas. Las {stats.invalid_rows} filas inválidas serán omitidas. ¿Continuar?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Volver</AlertDialogCancel><AlertDialogAction onClick={confirmImport} className="bg-amber-600 hover:bg-amber-700">Continuar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
          </div>
        )}

        {step === 'importing' && <div className="flex min-h-72 flex-col items-center justify-center gap-5"><Loader2 className="size-12 animate-spin text-amber-600" /><div className="text-center"><p className="font-semibold">Insertando {importProgress.current} de {importProgress.total || stats?.valid_rows || rows.length}…</p><p className="text-sm text-muted-foreground">Los registros se procesan en lotes seguros de 200.</p></div><Progress value={importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0} className="max-w-md" /></div>}

        {step === 'done' && result && <div className="flex min-h-72 flex-col items-center justify-center gap-5 text-center"><CheckCircle2 className="size-14 text-emerald-600" /><div><h3 className="text-xl font-bold">Importación completada</h3><p className="mt-1 text-muted-foreground">{result.inserted} insertados · {result.skipped} omitidos</p></div>{result.errors.length > 0 && <ScrollArea className="h-28 w-full max-w-2xl rounded-lg border p-3 text-left text-sm text-destructive">{result.errors.map((error) => <p key={error}>{error}</p>)}</ScrollArea>}<div className="flex gap-2"><Button variant="outline" onClick={reset}><RotateCcw className="mr-2 size-4" />Importar otro archivo</Button><Button onClick={() => { onImportComplete(); onOpenChange(false); reset(); }}>Cerrar</Button></div></div>}
      </DialogContent>
    </Dialog>
  );
}
