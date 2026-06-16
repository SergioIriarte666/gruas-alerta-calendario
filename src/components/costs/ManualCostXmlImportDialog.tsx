import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cost } from '@/types/costs';
import { useXMLParsing } from '@/hooks/useXMLParsing';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useUniversalSync } from '@/hooks/useUniversalSync';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  applyManualCostXmlImport,
  buildManualCostXmlPreview,
  getLatestRevertibleManualCostXmlImport,
  ManualCostXmlFieldChange,
  ManualCostXmlImportMode,
  ManualCostXmlPreview,
  revertManualCostXmlImport,
} from '@/services/manualCostXmlImport';
import { findSupplierByIdentity } from '@/utils/supplierIdentity';
import { createLogger } from '@/lib/logger';
import {
  AlertTriangle,
  ArrowRightLeft,
  FileUp,
  FileWarning,
  History,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const logger = createLogger('ManualCostXmlImportDialog');

interface ManualCostXmlImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cost: Cost;
  onImported?: (updatedCost: Cost) => void;
}

export const ManualCostXmlImportDialog = ({
  open,
  onOpenChange,
  cost,
  onImported,
}: ManualCostXmlImportDialogProps) => {
  const queryClient = useQueryClient();
  const { suppliers = [] } = useSuppliers();
  const { invalidateAll } = useUniversalSync();
  const [mode, setMode] = useState<ManualCostXmlImportMode>('complement');
  const [preview, setPreview] = useState<ManualCostXmlPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmedConflictCodes, setConfirmedConflictCodes] = useState<string[]>([]);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [confirmRevertOpen, setConfirmRevertOpen] = useState(false);

  const {
    selectedFile,
    parseResult,
    isAnalyzing,
    getRootProps,
    getInputProps,
    isDragActive,
    handleAnalyzeFile,
    reset,
  } = useXMLParsing();

  const latestSnapshotQuery = useQuery({
    queryKey: ['manual-cost-xml-import-latest', cost.id, open],
    queryFn: () => getLatestRevertibleManualCostXmlImport(cost.id),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setMode('complement');
      setPreview(null);
      setPreviewError(null);
      setConfirmedConflictCodes([]);
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!selectedFile || !parseResult) {
      setPreview(null);
      setPreviewError(null);
      setConfirmedConflictCodes([]);
      return;
    }

    try {
      if (parseResult.documents.length === 0) {
        throw new Error(parseResult.errors[0] || 'El XML no contiene documentos válidos');
      }

      if (parseResult.documents.length > 1) {
        throw new Error('El archivo contiene más de un documento. Seleccione un XML con una sola factura');
      }

      const [document] = parseResult.documents;
      const supplier =
        parseResult.suppliers.find((item) => item.rut === document.supplier_rut) ||
        parseResult.suppliers[0] ||
        null;
      const supplierMatch =
        (supplier &&
          (findSupplierByIdentity(
            suppliers as Array<{ name: string; rut: string | null }>,
            { name: supplier.name, rut: supplier.rut }
          ) as (typeof suppliers)[number] | undefined)) ||
        null;

      const nextPreview = buildManualCostXmlPreview({
        cost,
        document,
        supplier,
        supplierMatch,
        mode,
        fileName: selectedFile.name,
      });

      setPreview(nextPreview);
      setPreviewError(null);
      setConfirmedConflictCodes([]);
    } catch (error) {
      setPreview(null);
      setPreviewError(error instanceof Error ? error.message : 'No se pudo generar la vista previa del XML');
    }
  }, [cost, mode, parseResult, selectedFile, suppliers]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!preview || !selectedFile) {
        throw new Error('Debe cargar y analizar un XML antes de importarlo');
      }

      return applyManualCostXmlImport({
        costId: cost.id,
        fileName: selectedFile.name,
        mode,
        document: preview.document,
        supplier: preview.supplier,
        suppliers,
        confirmedConflictCodes,
      });
    },
    onSuccess: async (result) => {
      invalidateAll();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['costs'] }),
        queryClient.invalidateQueries({ queryKey: ['manual-cost-xml-import-latest', cost.id] }),
      ]);
      toast.success('XML importado correctamente en el costo');
      onImported?.(result.updatedCost);
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Error applying manual XML import', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo importar el XML en el costo');
    },
  });

  const revertMutation = useMutation({
    mutationFn: async () => {
      const latestSnapshot = latestSnapshotQuery.data;
      if (!latestSnapshot) {
        throw new Error('No hay una importación manual disponible para revertir');
      }

      return revertManualCostXmlImport({
        costId: cost.id,
        historyId: latestSnapshot.historyId,
      });
    },
    onSuccess: async (updatedCost) => {
      invalidateAll();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['costs'] }),
        queryClient.invalidateQueries({ queryKey: ['manual-cost-xml-import-latest', cost.id] }),
      ]);
      toast.success('Se revirtió la última importación XML del costo');
      onImported?.(updatedCost);
      setConfirmRevertOpen(false);
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Error reverting manual XML import', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo revertir la importación XML');
    },
  });

  const blockingConflicts = preview?.conflicts.filter((item) => item.severity === 'error') || [];
  const warningConflicts = preview?.conflicts.filter((item) => item.severity === 'warning') || [];

  const canSubmit = useMemo(() => {
    if (!preview || blockingConflicts.length > 0) return false;
    if (warningConflicts.length === 0) return true;
    return warningConflicts.every((item) => confirmedConflictCodes.includes(item.code));
  }, [blockingConflicts.length, confirmedConflictCodes, preview, warningConflicts]);

  const changeRows = useMemo(() => {
    return (preview?.fieldChanges || []).filter(
      (item) => item.action !== 'keep' || String(item.currentValue ?? '') !== String(item.incomingValue ?? '')
    );
  }, [preview]);

  const handleConflictToggle = (code: string, checked: boolean) => {
    setConfirmedConflictCodes((current) => {
      if (checked) {
        return Array.from(new Set([...current, code]));
      }
      return current.filter((item) => item !== code);
    });
  };

  const handleConfirmImport = async () => {
    try {
      await applyMutation.mutateAsync();
      setConfirmImportOpen(false);
    } catch {
      // El error ya es manejado por onError de la mutación.
    }
  };

  const handleConfirmRevert = async () => {
    try {
      await revertMutation.mutateAsync();
    } catch {
      // El error ya es manejado por onError de la mutación.
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(92dvh,56rem)] w-[95vw] max-w-5xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="size-5 text-primary" />
              Importar XML en costo existente
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
            <Alert>
              <ShieldCheck className="size-4" />
              <AlertDescription>
                Esta acción usa el mismo formato XML del importador existente y actualiza el costo guardado con
                auditoría, confirmación de conflictos y opción de reversión.
              </AlertDescription>
            </Alert>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Costo seleccionado</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoLine label="Descripción" value={cost.description} />
                <InfoLine label="Fecha costo" value={format(new Date(`${cost.date}T12:00:00Z`), 'dd MMM yyyy', { locale: es })} />
                <InfoLine label="Monto actual" value={formatCurrency(Number(cost.amount || 0))} />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <XMLDropzoneArea
                  selectedFile={selectedFile}
                  parseResult={parseResult}
                  isAnalyzing={isAnalyzing}
                  isDragActive={isDragActive}
                  getRootProps={getRootProps}
                  getInputProps={getInputProps}
                  onAnalyze={() => void handleAnalyzeFile()}
                  onReset={reset}
                  badges={['Compatibilidad con importador actual', 'Vista previa', 'Rollback']}
                />

                {previewError && (
                  <Alert variant="destructive">
                    <FileWarning className="size-4" />
                    <AlertDescription>{previewError}</AlertDescription>
                  </Alert>
                )}

                {parseResult?.warnings?.length ? (
                  <Alert>
                    <AlertTriangle className="size-4" />
                    <AlertDescription>
                      {parseResult.warnings.slice(0, 3).join(' | ')}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {preview && (
                  <>
                    <Card className="border-border/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Waypoints className="size-4 text-primary" />
                          Modo de actualización
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-2">
                        <ModeCard
                          active={mode === 'complement'}
                          title="Complementar"
                          description="Completa campos vacíos y conserva los datos existentes."
                          onClick={() => setMode('complement')}
                        />
                        <ModeCard
                          active={mode === 'overwrite'}
                          title="Sobrescribir"
                          description="Reemplaza los datos actuales del costo con la información del XML."
                          onClick={() => setMode('overwrite')}
                        />
                      </CardContent>
                    </Card>

                    <Card className="border-border/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Vista previa del XML</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <InfoLine label="Factura" value={preview.document.folio} />
                          <InfoLine label="Tipo" value={preview.document.document_type} />
                          <InfoLine label="Fecha emisión" value={preview.document.issue_date} />
                          <InfoLine label="Monto XML" value={formatCurrency(preview.document.total_amount)} />
                          <InfoLine
                            label="Proveedor"
                            value={preview.supplier?.name || 'Sin nombre detectado'}
                          />
                          <InfoLine
                            label="Proveedor en sistema"
                            value={
                              preview.supplierMatch?.name ||
                              (preview.supplierWillBeCreated ? 'Se creará automáticamente' : 'Sin coincidencia')
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium">Conceptos detectados</p>
                          <div className="space-y-2">
                            {(preview.document.items || []).length > 0 ? (
                              preview.document.items?.map((item, index) => (
                                <div
                                  key={`${item.description}-${index}`}
                                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span>{item.description}</span>
                                    <span className="text-muted-foreground">
                                      {formatCurrency(Number(item.total || 0))}
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                                El XML no contiene líneas detalladas. Se usará la descripción general del documento.
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ArrowRightLeft className="size-4 text-primary" />
                      Cambios a aplicar
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {changeRows.length > 0 ? (
                      changeRows.map((change) => (
                        <div key={change.field}>
                          <FieldChangeRow change={change} />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay cambios efectivos para aplicar con el modo seleccionado.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Validaciones y conflictos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {preview ? (
                      <>
                        {preview.conflicts.length === 0 ? (
                          <Alert>
                            <ShieldCheck className="size-4" />
                            <AlertDescription>
                              No se detectaron conflictos bloqueantes. La importación puede ejecutarse.
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        {blockingConflicts.map((conflict) => (
                          <Alert key={conflict.code} variant="destructive">
                            <AlertTriangle className="size-4" />
                            <AlertDescription>{conflict.message}</AlertDescription>
                          </Alert>
                        ))}

                        {warningConflicts.map((conflict) => (
                          <div
                            key={conflict.code}
                            className="rounded-lg border border-warning/40 bg-warning/10 p-3"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id={conflict.code}
                                checked={confirmedConflictCodes.includes(conflict.code)}
                                onCheckedChange={(checked) => handleConflictToggle(conflict.code, checked === true)}
                              />
                              <div className="space-y-1">
                                <Label htmlFor={conflict.code} className="cursor-pointer text-sm font-medium">
                                  Confirmo este conflicto
                                </Label>
                                <p className="text-sm text-muted-foreground">{conflict.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Cargue un archivo XML para ver validaciones, conflictos y confirmaciones requeridas.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="size-4 text-primary" />
                      Reversión disponible
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {latestSnapshotQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Buscando importaciones reversibles...
                      </div>
                    ) : latestSnapshotQuery.data ? (
                      <>
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                          <p className="font-medium">{latestSnapshotQuery.data.summary || 'Última importación XML'}</p>
                          <p className="text-muted-foreground">
                            {format(new Date(latestSnapshotQuery.data.changedAt), "dd 'de' MMMM yyyy, HH:mm", {
                              locale: es,
                            })}
                          </p>
                          {latestSnapshotQuery.data.fileName ? (
                            <p className="mt-1 text-muted-foreground">Archivo: {latestSnapshotQuery.data.fileName}</p>
                          ) : null}
                        </div>
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => setConfirmRevertOpen(true)}
                          disabled={revertMutation.isPending}
                        >
                          {revertMutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="size-4" />
                          )}
                          Revertir última importación XML
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay importaciones XML manuales pendientes de reversión para este costo.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            </div>
          </div>

          <div className="shrink-0 border-t px-6 py-4">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => setConfirmImportOpen(true)}
                disabled={!canSubmit || applyMutation.isPending}
                className="gap-2"
              >
                {applyMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                Aplicar importación XML
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importación XML</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará el costo, se registrará auditoría y se vinculará la factura del XML. Puede revertir la
              operación posteriormente desde esta misma herramienta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void handleConfirmImport()}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmar importación
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRevertOpen} onOpenChange={setConfirmRevertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revertir importación XML</AlertDialogTitle>
            <AlertDialogDescription>
              Se restaurarán los datos originales del costo y la vinculación de factura/pago de la última importación
              XML manual reversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void handleConfirmRevert()}
              disabled={revertMutation.isPending}
            >
              {revertMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Revertir importación
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const ModeCard = ({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border p-4 text-left transition-colors ${
      active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border/70 hover:border-primary/40'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium">{title}</span>
      {active ? <Badge>Seleccionado</Badge> : null}
    </div>
    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  </button>
);

const FieldChangeRow = ({ change }: { change: ManualCostXmlFieldChange }) => (
  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-sm font-medium">{change.label}</p>
      <Badge className={change.action === 'overwrite' ? 'bg-destructive text-destructive-foreground' : ''}>
        {change.action === 'fill' ? 'Completa' : change.action === 'overwrite' ? 'Sobrescribe' : 'Sin cambio'}
      </Badge>
    </div>
    <div className="grid gap-2 text-sm md:grid-cols-2">
      <div>
        <p className="text-xs text-muted-foreground">Actual</p>
        <p>{formatValue(change.currentValue)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">XML</p>
        <p>{formatValue(change.incomingValue)}</p>
      </div>
    </div>
  </div>
);

const InfoLine = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-medium">{value}</p>
  </div>
);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Sin valor';
  if (typeof value === 'number') return formatCurrency(value);
  return String(value);
};
