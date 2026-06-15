import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  BankStatementInvoiceCandidate,
  BankStatementMovement,
  useBankStatementReconciliation,
} from '@/hooks/useBankStatementReconciliation';
import { useAIBankMatch } from '@/hooks/useAIBankMatch';
import { getUsableAISuggestedInvoiceId, rankCandidatesWithAISuggestion } from '@/utils/bankStatementAIMatch';

interface BankStatementReconciliationPanelProps {
  onPaymentsChanged?: () => void | Promise<void>;
}

type MovementStatusFilter = 'all' | 'pending' | 'matched' | 'reconciled' | 'exception';
type MovementAmountFilter = 'all' | 'positive' | 'non_positive';

const formatDate = (value?: string | null) => {
  if (!value) return '-';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-CL');
};

const getMovementStatusLabel = (status: string) => {
  switch (status) {
    case 'reconciled':
      return 'Ya conciliado';
    case 'matched':
      return 'Coincidencia';
    case 'exception':
      return 'Excepción';
    default:
      return 'Pendiente';
  }
};

const isMovementReconciled = (
  movement?: Pick<BankStatementMovement, 'reconciliation_status' | 'matched_invoice_id' | 'payment_id'> | null,
) => Boolean(movement) && (movement?.reconciliation_status === 'reconciled' || !!movement?.matched_invoice_id || !!movement?.payment_id);

const getEffectiveMovementStatus = (
  movement?: Pick<BankStatementMovement, 'reconciliation_status' | 'matched_invoice_id' | 'payment_id'> | null,
) => (isMovementReconciled(movement) ? 'reconciled' : movement?.reconciliation_status ?? 'pending');

const getMovementStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
  switch (status) {
    case 'reconciled':
      return 'default';
    case 'matched':
      return 'secondary';
    default:
      return 'outline';
  }
};

const readPositiveMovementsFromSummary = (summary: unknown) => {
  if (!summary || typeof summary !== 'object') return null;

  const parsedSummary = (summary as Record<string, unknown>).parsed_summary;
  if (!parsedSummary || typeof parsedSummary !== 'object') return null;

  const positive = (parsedSummary as Record<string, unknown>).positiveMovements;
  return typeof positive === 'number' ? positive : null;
};

const getExceptionReason = (movement?: Pick<BankStatementMovement, 'raw_payload'> | null) => {
  if (!movement?.raw_payload || typeof movement.raw_payload !== 'object' || Array.isArray(movement.raw_payload)) {
    return null;
  }

  const reason = (movement.raw_payload as Record<string, unknown>).exception_reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
};

const normalizeRut = (value?: string | null) => value?.replace(/[^0-9Kk]/g, '').toUpperCase().replace(/^0+/, '') ?? '';

const formatRut = (value?: string | null) => {
  const normalized = normalizeRut(value);
  if (normalized.length < 2) return value ?? '-';

  const body = normalized.slice(0, -1);
  const verifier = normalized.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formattedBody}-${verifier}`;
};

const buildRutQueryVariants = (value?: string | null) => {
  const normalized = normalizeRut(value);
  if (normalized.length < 2) return [];

  const body = normalized.slice(0, -1);
  const verifier = normalized.slice(-1);
  const dotted = `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${verifier}`;
  const plainWithHyphen = `${body}-${verifier}`;

  return Array.from(
    new Set([normalized, normalized.toLowerCase(), dotted, dotted.toLowerCase(), plainWithHyphen, plainWithHyphen.toLowerCase()]),
  );
};

const extractDetectedRuts = (movement?: Pick<
  BankStatementMovement,
  'description' | 'reference_id' | 'payer_name' | 'raw_payload'
> | null) => {
  if (!movement) return [];

  const rawPayloadText =
    movement.raw_payload && typeof movement.raw_payload === 'object' ? JSON.stringify(movement.raw_payload) : '';
  const haystack = [movement.description, movement.reference_id, movement.payer_name, rawPayloadText]
    .filter(Boolean)
    .join(' ');

  const matches = haystack.matchAll(
    /(^|[^0-9k])([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9k]|0[0-9]{8}[0-9k]|[0-9]{7,8}-?[0-9k])([^0-9k]|$)/gi,
  );

  const uniqueRuts = new Set<string>();
  for (const match of matches) {
    const normalized = normalizeRut(match[2] || '');
    if (normalized.length >= 8) {
      uniqueRuts.add(normalized);
    }
  }

  return Array.from(uniqueRuts);
};

const getPlatformClientLabels = (
  detectedRuts: string[],
  clientNameByRut: Record<string, string>,
) =>
  detectedRuts
    .map((rut) => {
      const clientName = clientNameByRut[normalizeRut(rut)];
      if (!clientName) return null;
      return `${clientName} (${formatRut(rut)})`;
    })
    .filter((value): value is string => Boolean(value));

const matchesMovementSearch = (movement: BankStatementMovement, search: string) => {
  if (!search.trim()) return true;

  const haystack = [
    movement.description,
    movement.reference_id,
    movement.payer_name,
    getExceptionReason(movement),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(search.trim().toLowerCase());
};

const getMovementSortPriority = (movement: BankStatementMovement) => {
  const isPositive = movement.amount > 0;
  const effectiveStatus = getEffectiveMovementStatus(movement);

  switch (effectiveStatus) {
    case 'pending':
      return isPositive ? 0 : 1;
    case 'matched':
      return isPositive ? 2 : 3;
    case 'exception':
      return isPositive ? 4 : 5;
    case 'reconciled':
      return 6;
    default:
      return 7;
  }
};

const isStrongCandidateMatch = (candidate: BankStatementInvoiceCandidate) => candidate.match_score >= 140;

export const BankStatementReconciliationPanel: React.FC<BankStatementReconciliationPanelProps> = ({
  onPaymentsChanged,
}) => {
  const {
    imports,
    importsLoading,
    importsRefetch,
    movements,
    movementsLoading,
    selectedImport,
    selectedImportId,
    setSelectedImportId,
    candidateMap,
    allPaidMovementIds,
    loadCandidates,
    loadingCandidatesMovementId,
    uploadStatement,
    isUploading,
    markMovementException,
    exceptingMovementId,
    reconcileMovement,
    reconcilingMovementId,
  } = useBankStatementReconciliation();

  const { aiSuggestion, isLoadingAI, aiError, suggestMatch, clearSuggestion: clearAISuggestion } = useAIBankMatch();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<BankStatementMovement | null>(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<MovementStatusFilter>('all');
  const [amountFilter, setAmountFilter] = useState<MovementAmountFilter>('positive');
  const [searchTerm, setSearchTerm] = useState('');
  const [reconciliationDate, setReconciliationDate] = useState('');

  const sortedMovements = useMemo(() => {
    return [...movements].sort((a, b) => {
      const priorityDiff = getMovementSortPriority(a) - getMovementSortPriority(b);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      if (a.reconciliation_status === b.reconciliation_status) {
        return b.transaction_date.localeCompare(a.transaction_date) || a.row_index - b.row_index;
      }

      return a.reconciliation_status.localeCompare(b.reconciliation_status);
    });
  }, [movements]);

  const visibleMovements = useMemo(() => {
    return sortedMovements.filter((movement) => {
      const effectiveStatus = getEffectiveMovementStatus(movement);
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) {
        return false;
      }
      if (amountFilter === 'positive' && movement.amount <= 0) {
        return false;
      }

      if (amountFilter === 'non_positive' && movement.amount > 0) {
        return false;
      }

      return matchesMovementSearch(movement, searchTerm);
    });
  }, [amountFilter, searchTerm, sortedMovements, statusFilter]);

  const currentSelectedMovement = useMemo(
    () => (selectedMovement ? movements.find((movement) => movement.id === selectedMovement.id) ?? selectedMovement : null),
    [movements, selectedMovement],
  );
  const selectedMovementCandidates = currentSelectedMovement ? candidateMap[currentSelectedMovement.id] ?? [] : [];
  const usableAISuggestedInvoiceId = useMemo(
    () => getUsableAISuggestedInvoiceId(selectedMovementCandidates, aiSuggestion),
    [aiSuggestion, selectedMovementCandidates],
  );
  const rankedSelectedMovementCandidates = useMemo(
    () => rankCandidatesWithAISuggestion(selectedMovementCandidates, aiSuggestion),
    [aiSuggestion, selectedMovementCandidates],
  );
  const selectedMovementExceptionReason = getExceptionReason(currentSelectedMovement);
  const selectedMovementDetectedRuts = useMemo(() => extractDetectedRuts(currentSelectedMovement), [currentSelectedMovement]);
  const allDetectedRuts = useMemo(() => {
    const uniqueRuts = new Set<string>();

    for (const movement of movements) {
      for (const rut of extractDetectedRuts(movement)) {
        uniqueRuts.add(normalizeRut(rut));
      }
    }

    return Array.from(uniqueRuts);
  }, [movements]);
  const hasActiveFilters = statusFilter !== 'all' || amountFilter !== 'positive' || searchTerm.trim().length > 0;

  const clientsByDetectedRutQuery = useQuery({
    queryKey: ['bank-statement-detected-rut-clients', allDetectedRuts],
    enabled: allDetectedRuts.length > 0,
    staleTime: 60000,
    queryFn: async () => {
      const rutVariants = Array.from(new Set(allDetectedRuts.flatMap((rut) => buildRutQueryVariants(rut))));
      if (rutVariants.length === 0) return {} as Record<string, string>;

      const { data, error } = await supabase
        .from('clients')
        .select('name, rut')
        .in('rut', rutVariants);

      if (error) throw error;

      return (data ?? []).reduce<Record<string, string>>((acc, client) => {
        const normalizedRut = normalizeRut(client.rut);
        if (normalizedRut) {
          acc[normalizedRut] = client.name;
        }
        return acc;
      }, {});
    },
  });

  const clientNameByRut = clientsByDetectedRutQuery.data ?? {};

  const summary = useMemo(() => {
    const positiveMovements =
      movements.filter((movement) => movement.amount > 0).length ||
      readPositiveMovementsFromSummary(selectedImport?.processing_summary) ||
      0;

    return {
      total: movements.length,
      pending: movements.filter((movement) => getEffectiveMovementStatus(movement) === 'pending').length,
      reconciled: movements.filter((movement) => getEffectiveMovementStatus(movement) === 'reconciled').length,
      exceptions: movements.filter((movement) => getEffectiveMovementStatus(movement) === 'exception').length,
      positiveMovements,
    };
  }, [movements, selectedImport?.processing_summary]);

  const openMovementDetails = async (movement: BankStatementMovement) => {
    setSelectedMovement(movement);
    setDetailsOpen(true);
    clearAISuggestion();
    setReconciliationDate(movement.transaction_date || '');

    try {
      const candidates = await loadCandidates(movement.id);
      if (candidates && candidates.length > 0 && !isMovementReconciled(movement)) {
        await suggestMatch(movement, candidates);
      }
    } catch {
      // Error already handled in hook
    }
  };

  const handleReloadCandidates = async () => {
    if (!selectedMovement || !currentSelectedMovement) return;

    try {
      clearAISuggestion();
      const candidates = await loadCandidates(selectedMovement.id, true);
      if (candidates && candidates.length > 0 && !isMovementReconciled(currentSelectedMovement)) {
        await suggestMatch(currentSelectedMovement, candidates, true);
      }
    } catch {
      // Error already handled in hook
    }
  };

  const handleReconcile = async (candidate: BankStatementInvoiceCandidate) => {
    if (!selectedMovement) return;

    try {
      await reconcileMovement(selectedMovement.id, candidate.invoice_id, reconciliationDate || undefined);
      await loadCandidates(selectedMovement.id, true);
      await onPaymentsChanged?.();
      setDetailsOpen(false);
    } catch {
      // Error already handled in hook
    }
  };

  const handleMarkException = async () => {
    if (!selectedMovement) return;

    try {
      await markMovementException(selectedMovement.id, exceptionReason.trim() || undefined);
      await onPaymentsChanged?.();
      setExceptionDialogOpen(false);
      setExceptionReason('');
      setDetailsOpen(false);
    } catch {
      // Error already handled in hook
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const [file] = acceptedFiles;
    if (!file) return;

    try {
      await uploadStatement(file);
    } catch {
      // Error already handled in hook
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Conciliación con Cartolas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Importa movimientos bancarios desde XLS, XLSX o PDF y concilia solo pagos totales exactos, sin parciales.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importsRefetch()}
                disabled={importsLoading || movementsLoading}
              >
                <RefreshCw className={cn('size-4 mr-2', (importsLoading || movementsLoading) && 'animate-spin')} />
                Actualizar
              </Button>
              <Button type="button" size="sm" onClick={open} disabled={isUploading}>
                {isUploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
                Cargar Cartola
              </Button>
            </div>
          </div>

        </CardHeader>

        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              'rounded-lg border border-dashed p-6 transition-colors',
              isDragActive ? 'border-primary bg-primary/5' : 'border-border',
              isUploading && 'pointer-events-none opacity-70',
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Arrastra una cartola XLS, XLSX o PDF aquí</p>
                <p className="text-sm text-muted-foreground">
                  Se guardará en staging para revisar movimientos antes de conciliar.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={open} disabled={isUploading}>
                Seleccionar archivo
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Importaciones</p>
                <p className="text-2xl font-bold">{imports.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Abonos positivos</p>
                <p className="text-2xl font-bold">{summary.positiveMovements}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold">{summary.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Conciliados</p>
                <p className="text-2xl font-bold">{summary.reconciled}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="w-full xl:max-w-sm">
              <Select value={selectedImportId ?? ''} onValueChange={setSelectedImportId} disabled={imports.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una importación" />
                </SelectTrigger>
                <SelectContent>
                  {imports.map((statementImport) => (
                    <SelectItem key={statementImport.id} value={statementImport.id}>
                      {statementImport.file_name} · {formatDate(statementImport.created_at?.slice(0, 10))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedImport && (
              <div className="text-sm text-muted-foreground">
                Banco: {selectedImport.bank_name || 'No detectado'} · Estado: {selectedImport.status} · Movimientos:{' '}
                {selectedImport.total_movements}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.8fr)_220px_220px_auto]">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por descripcion, referencia, ordenante o motivo"
              disabled={!selectedImport}
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as MovementStatusFilter)}>
              <SelectTrigger disabled={!selectedImport}>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="matched">Coincidencia</SelectItem>
                <SelectItem value="exception">Excepciones</SelectItem>
                <SelectItem value="reconciled">Conciliados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={amountFilter} onValueChange={(value) => setAmountFilter(value as MovementAmountFilter)}>
              <SelectTrigger disabled={!selectedImport}>
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="positive">Solo abonos positivos</SelectItem>
                <SelectItem value="all">Todos los movimientos</SelectItem>
                <SelectItem value="non_positive">Solo no conciliables</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setAmountFilter('positive');
              }}
              disabled={!selectedImport || !hasActiveFilters}
            >
              Limpiar filtros
            </Button>
          </div>

          {selectedImport && (
            <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {visibleMovements.length} de {summary.total} movimientos.
              </span>
              <span>
                Excepciones registradas: {summary.exceptions}. La vista prioriza pendientes conciliables con pago exacto.
              </span>
            </div>
          )}

          {!selectedImport ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              Aún no hay cartolas importadas.
            </div>
          ) : movementsLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border p-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando movimientos...
            </div>
          ) : visibleMovements.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              Esta importación no tiene movimientos utilizables.
            </div>
          ) : (
            <ScrollArea className="h-[440px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{formatDate(movement.transaction_date)}</TableCell>
                      <TableCell className="max-w-[340px]">
                        {(() => {
                          const movementDetectedRuts = extractDetectedRuts(movement);
                          const platformClientLabels = getPlatformClientLabels(movementDetectedRuts, clientNameByRut);

                          return (
                            <>
                        <div className="truncate font-medium">{movement.description || 'Sin descripción'}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {movement.payer_name || 'Sin ordenante'}
                        </div>
                        {platformClientLabels.length > 0 && (
                          <div className="truncate text-xs text-primary">
                            Cliente plataforma: {platformClientLabels.join(', ')}
                          </div>
                        )}
                        {getEffectiveMovementStatus(movement) === 'reconciled' && (
                          <div className="flex items-center gap-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="size-3 flex-shrink-0" />
                            Ya conciliado
                          </div>
                        )}
                        {getEffectiveMovementStatus(movement) === 'exception' && getExceptionReason(movement) && (
                          <div className="truncate text-xs text-amber-700">
                            Excepción: {getExceptionReason(movement)}
                          </div>
                        )}
                        {allPaidMovementIds.has(movement.id) && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-600">
                            <AlertTriangle className="size-3 flex-shrink-0" />
                            Facturas de este cliente ya conciliadas
                          </div>
                        )}
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{movement.reference_id || '-'}</TableCell>
                      <TableCell className={movement.amount > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                        {formatCurrency(movement.amount, movement.currency || 'CLP')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getMovementStatusVariant(getEffectiveMovementStatus(movement))}>
                          {getMovementStatusLabel(getEffectiveMovementStatus(movement))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!isMovementReconciled(movement) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                setSelectedMovement(movement);
                                setExceptionReason(getExceptionReason(movement) ?? '');
                                setExceptionDialogOpen(true);
                              }}
                            >
                              Excepción
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="outline" onClick={() => openMovementDetails(movement)}>
                            Revisar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) clearAISuggestion(); }}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Revisión de movimiento bancario</DialogTitle>
          </DialogHeader>

          {currentSelectedMovement && (
            <div className="flex-1 space-y-4 overflow-hidden">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Fecha pago cartola</p>
                    <p className="font-semibold">{formatDate(currentSelectedMovement.transaction_date)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Se conserva al aplicar la conciliación exacta.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Monto</p>
                    <p className="font-semibold">
                      {formatCurrency(currentSelectedMovement.amount, currentSelectedMovement.currency || 'CLP')}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Estado</p>
                    <Badge variant={getMovementStatusVariant(getEffectiveMovementStatus(currentSelectedMovement))}>
                      {getMovementStatusLabel(getEffectiveMovementStatus(currentSelectedMovement))}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Referencia</p>
                    <p className="font-semibold truncate">{currentSelectedMovement.reference_id || '-'}</p>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <AlertTriangle className="size-4" />
                <AlertTitle>Descripción del movimiento</AlertTitle>
                <AlertDescription>{currentSelectedMovement.description || 'Sin descripción'}</AlertDescription>
              </Alert>

              {isMovementReconciled(currentSelectedMovement) && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <AlertTitle>Movimiento ya conciliado</AlertTitle>
                  <AlertDescription>
                    Este abono ya fue aplicado con pago total exacto y conserva la fecha de pago de la cartola.
                  </AlertDescription>
                </Alert>
              )}

              {currentSelectedMovement.amount <= 0 && (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Movimiento no conciliable</AlertTitle>
                  <AlertDescription>
                    La RPC actual solo permite conciliar abonos positivos. Este movimiento queda visible para revisión,
                    pero no se puede aplicar todavía.
                  </AlertDescription>
                </Alert>
              )}

              {selectedMovementExceptionReason && (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Motivo de excepción</AlertTitle>
                  <AlertDescription>{selectedMovementExceptionReason}</AlertDescription>
                </Alert>
              )}

              {selectedMovementDetectedRuts.length > 0 && (
                <Alert className="border-primary/20 bg-primary/5">
                  <CheckCircle2 className="size-4 text-primary" />
                  <AlertTitle>Filtro por RUT detectado</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      RUT detectado en cartola:{' '}
                      {selectedMovementDetectedRuts.map((rut) => formatRut(rut)).join(', ')}.
                    </p>
                    {getPlatformClientLabels(selectedMovementDetectedRuts, clientNameByRut).length > 0 && (
                      <p>
                        Cliente en plataforma:{' '}
                        {getPlatformClientLabels(selectedMovementDetectedRuts, clientNameByRut).join(', ')}.
                      </p>
                    )}
                    <p>Las facturas candidatas se filtran estrictamente por ese cliente.</p>
                  </AlertDescription>
                </Alert>
              )}

              {(isLoadingAI || aiSuggestion || aiError) && (
                <div className={cn(
                  'rounded-lg border p-4 space-y-2',
                  isLoadingAI && 'border-border bg-muted/30',
                  aiSuggestion?.suggestion_type === 'exact' && 'border-green-200 bg-green-50',
                  aiSuggestion?.suggestion_type === 'probable' && 'border-violet-200 bg-violet-50',
                  aiSuggestion?.suggestion_type === 'uncertain' && 'border-amber-200 bg-amber-50',
                  aiSuggestion?.suggestion_type === 'none' && 'border-border bg-muted/30',
                  aiError && 'border-destructive/30 bg-destructive/5',
                )}>
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn(
                      'size-4 flex-shrink-0',
                      isLoadingAI && 'animate-pulse text-muted-foreground',
                      aiSuggestion?.suggestion_type === 'exact' && 'text-green-600',
                      aiSuggestion?.suggestion_type === 'probable' && 'text-violet-600',
                      aiSuggestion?.suggestion_type === 'uncertain' && 'text-amber-600',
                      aiSuggestion?.suggestion_type === 'none' && 'text-muted-foreground',
                      aiError && 'text-destructive',
                    )} />
                    <span className="text-sm font-medium">
                      {isLoadingAI && 'Analizando con IA...'}
                      {!isLoadingAI && aiSuggestion?.suggestion_type === 'exact' && 'IA: Coincidencia clara'}
                      {!isLoadingAI && aiSuggestion?.suggestion_type === 'probable' && 'IA: Coincidencia probable'}
                      {!isLoadingAI && aiSuggestion?.suggestion_type === 'uncertain' && 'IA: Coincidencia incierta'}
                      {!isLoadingAI && aiSuggestion?.suggestion_type === 'none' && 'IA: Sin sugerencia'}
                      {!isLoadingAI && aiError && 'IA no disponible'}
                    </span>
                    {aiSuggestion && !isLoadingAI && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Confianza: {Math.round((aiSuggestion.confidence ?? 0) * 100)}%
                      </span>
                    )}
                  </div>
                  {aiSuggestion?.reasoning && !isLoadingAI && (
                    <p className="text-sm text-muted-foreground pl-6">{aiSuggestion.reasoning}</p>
                  )}
                  {aiError && !isLoadingAI && (
                    <p className="text-xs text-destructive pl-6">{aiError}</p>
                  )}
                </div>
              )}

              {!isMovementReconciled(currentSelectedMovement) && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <label className="text-sm font-medium whitespace-nowrap">Fecha de conciliacion</label>
                  <Input
                    type="date"
                    value={reconciliationDate}
                    onChange={(event) => setReconciliationDate(event.target.value)}
                    className="w-auto"
                  />
                  <span className="text-xs text-muted-foreground">
                    Por defecto se usa la fecha del movimiento en la cartola.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Facturas candidatas</h3>
                  <p className="text-sm text-muted-foreground">
                    Facturas ordenadas por coincidencia: monto exacto, RUT, número fiscal o razón social. Solo se puede conciliar si el monto coincide exactamente.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReloadCandidates}
                  disabled={loadingCandidatesMovementId === selectedMovement.id}
                >
                  {loadingCandidatesMovementId === selectedMovement.id ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4 mr-2" />
                  )}
                  Recalcular
                </Button>
              </div>

              {!isMovementReconciled(currentSelectedMovement) && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setExceptionReason(getExceptionReason(currentSelectedMovement) ?? '');
                      setExceptionDialogOpen(true);
                    }}
                    disabled={exceptingMovementId === currentSelectedMovement.id}
                  >
                    {exceptingMovementId === currentSelectedMovement.id ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : null}
                    {getEffectiveMovementStatus(currentSelectedMovement) === 'exception'
                      ? 'Actualizar excepción'
                      : 'Marcar como excepción'}
                  </Button>
                </div>
              )}

              {loadingCandidatesMovementId === currentSelectedMovement.id && selectedMovementCandidates.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border p-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando candidatas...
                </div>
              ) : isMovementReconciled(currentSelectedMovement) ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center text-sm text-green-700">
                  Este movimiento ya quedó conciliado. No requiere nuevas facturas candidatas.
                </div>
              ) : selectedMovementCandidates.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                  No se encontraron facturas candidatas por monto exacto.
                </div>
              ) : (
                <ScrollArea className="h-[340px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankedSelectedMovementCandidates.map((candidate) => (
                        <TableRow key={candidate.invoice_id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{candidate.folio || '-'}</div>
                              {usableAISuggestedInvoiceId === candidate.invoice_id && (
                                <Badge className="bg-violet-600 text-white hover:bg-violet-600">Sugerida por IA</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{candidate.numero_fiscal || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{candidate.client_name}</div>
                            <div className="text-xs text-muted-foreground">{candidate.client_rut || '-'}</div>
                          </TableCell>
                          <TableCell>{formatDate(candidate.due_date)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className={cn(
                                'font-medium',
                                candidate.already_paid && 'text-muted-foreground line-through',
                                !candidate.amount_matches && 'text-amber-600'
                              )}>
                                {formatCurrency(candidate.total)}
                              </div>
                              {candidate.already_paid && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  Ya pagada
                                </Badge>
                              )}
                              {!candidate.amount_matches && !candidate.already_paid && (
                                <div className="text-[10px] text-amber-600">
                                  Cartola: {formatCurrency(currentSelectedMovement?.amount ?? 0)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{candidate.match_score}</span>
                                {isStrongCandidateMatch(candidate) && <CheckCircle2 className="size-4 text-green-600" />}
                              </div>
                              <div className="max-w-[260px] text-xs text-muted-foreground">
                                {candidate.match_reason || 'Solo coincide por monto exacto; revisar datos de cartola.'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleReconcile(candidate)}
                              disabled={
                                reconcilingMovementId === currentSelectedMovement.id ||
                                currentSelectedMovement.amount <= 0 ||
                                isMovementReconciled(currentSelectedMovement) ||
                                candidate.already_paid ||
                                !candidate.amount_matches
                              }
                              title={
                                candidate.already_paid
                                  ? 'Esta factura ya está pagada'
                                  : !candidate.amount_matches
                                    ? 'El monto no coincide exactamente — verificar antes de conciliar'
                                    : 'Conciliar este movimiento con la factura'
                              }
                            >
                              {reconcilingMovementId === currentSelectedMovement.id ? (
                                <Loader2 className="size-4 mr-2 animate-spin" />
                              ) : null}
                              Conciliar exacto
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedMovement?.reconciliation_status === 'exception'
                ? 'Actualizar excepción del movimiento'
                : 'Marcar movimiento como excepción'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertTitle>Uso recomendado</AlertTitle>
              <AlertDescription>
                Marca como excepción movimientos sin factura exacta, con datos insuficientes o que deban revisarse fuera
                del flujo automático. Si ya existe una excepción, este formulario actualiza el motivo guardado.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo</label>
              <Textarea
                value={exceptionReason}
                onChange={(event) => setExceptionReason(event.target.value)}
                placeholder="Ejemplo: transferencia global, referencia incompleta, cliente no identificado..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setExceptionDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleMarkException}
                disabled={!selectedMovement || exceptingMovementId === selectedMovement.id}
              >
                {selectedMovement && exceptingMovementId === selectedMovement.id ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : null}
                {selectedMovement?.reconciliation_status === 'exception'
                  ? 'Guardar motivo'
                  : 'Confirmar excepción'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
