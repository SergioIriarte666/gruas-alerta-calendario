import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import { useClientPaymentImport } from '@/hooks/facturas/useClientPaymentImport';
import { downloadClientPaymentTemplate } from '@/utils/generateClientPaymentTemplate';
import type { ClientPaymentMatchStatus, ValidatedClientPaymentRow } from '@/types/clientPaymentImport';

const logger = createLogger('ClientPaymentImportDialog');

interface ClientPaymentImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_BADGE: Record<ClientPaymentMatchStatus, { label: string; variant: 'success' | 'destructive' | 'secondary' | 'warning' | 'outline' }> = {
  found: { label: 'Encontrada', variant: 'success' },
  not_found: { label: 'No encontrada', variant: 'destructive' },
  already_paid: { label: 'Ya pagada', variant: 'secondary' },
  partial_mismatch: { label: 'Monto diferente', variant: 'warning' },
  duplicate: { label: 'Duplicada', variant: 'outline' },
};

const ROW_BG: Record<ClientPaymentMatchStatus, string> = {
  found: '',
  not_found: 'bg-danger-soft',
  already_paid: 'bg-muted/50',
  partial_mismatch: '',
  duplicate: 'bg-warning-soft',
};

type SortColumn = 'referencia' | 'numeroFiscal' | 'monto' | 'saldo' | 'estado';

const SORTABLE_COLUMNS_BEFORE_FECHA: { key: SortColumn; label: string; className?: string }[] = [
  { key: 'referencia', label: 'NF' },
  { key: 'numeroFiscal', label: 'Nro. Fiscal' },
  { key: 'monto', label: 'Monto archivo', className: 'text-right' },
];

const SORTABLE_COLUMNS_AFTER_FECHA: { key: SortColumn; label: string; className?: string }[] = [
  { key: 'saldo', label: 'Saldo pendiente', className: 'text-right' },
  { key: 'estado', label: 'Estado' },
];

function formatFechaPago(fechaPago: string): string {
  if (!fechaPago) return '-';
  const [year, month, day] = fechaPago.split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
}

export function ClientPaymentImportDialog({ open, onClose }: ClientPaymentImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const {
    filename,
    validatedRows,
    step,
    isValidating,
    isImporting,
    progress,
    importErrors,
    loadFile,
    toggleIncluir,
    toggleAll,
    importRows,
    reset,
    setStep,
  } = useClientPaymentImport();

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelected = async (file: File) => {
    setIsLoadingFile(true);
    try {
      await loadFile(file);
    } catch (error) {
      logger.error('Error loading file', error);
      toast.error('Error al leer el archivo', { description: 'Verifica que sea un archivo .xlsx válido.' });
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleConfirmImport = async () => {
    try {
      const { imported, errors } = await importRows();
      const totalAmount = validatedRows
        .filter((row) => row.incluir && (row.matchStatus === 'found' || row.matchStatus === 'partial_mismatch'))
        .reduce((sum, row) => sum + row.monto, 0);

      if (errors.length === 0) {
        toast.success(`${imported} pagos importados — ${formatCurrency(totalAmount)} conciliados`);
      } else {
        toast.warning(`${imported} importados, ${errors.length} con error`);
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    } catch (error) {
      logger.error('Error importing rows', error);
      toast.error('Error al importar los pagos');
    }
  };

  const includedRows = validatedRows.filter((row) => row.incluir);
  const excludedCount = validatedRows.length - includedRows.length;
  const includedTotal = includedRows.reduce((sum, row) => sum + row.monto, 0);

  const canEditIncluir = (row: ValidatedClientPaymentRow) =>
    row.matchStatus === 'found' || row.matchStatus === 'partial_mismatch';
  const isIncluirChecked = (row: ValidatedClientPaymentRow) => row.incluir;

  const eligibleRows = validatedRows.filter(
    (row) => row.matchStatus === 'found' || row.matchStatus === 'partial_mismatch',
  );
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((row) => row.incluir);
  const someEligibleSelected = eligibleRows.some((row) => row.incluir);
  const masterCheckedState: boolean | 'indeterminate' = allEligibleSelected
    ? true
    : someEligibleSelected
      ? 'indeterminate'
      : false;

  const handleSortClick = (column: SortColumn) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  const displayRows = useMemo(() => {
    let result = [...validatedRows];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (row) =>
          row.referencia?.toLowerCase().includes(term) ||
          row.invoice?.numero_fiscal?.toLowerCase().includes(term),
      );
    }

    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';
        switch (sortColumn) {
          case 'referencia':
            valA = a.referencia;
            valB = b.referencia;
            break;
          case 'numeroFiscal':
            valA = a.invoice?.numero_fiscal ?? '';
            valB = b.invoice?.numero_fiscal ?? '';
            break;
          case 'monto':
            valA = a.monto ?? 0;
            valB = b.monto ?? 0;
            break;
          case 'saldo':
            valA = a.invoice?.remaining_amount ?? 0;
            valB = b.invoice?.remaining_amount ?? 0;
            break;
          case 'estado':
            valA = a.matchStatus;
            valB = b.matchStatus;
            break;
        }
        const cmp = typeof valA === 'number'
          ? valA - (valB as number)
          : String(valA).localeCompare(String(valB));
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [validatedRows, searchTerm, sortColumn, sortDirection]);

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ChevronsUpDown className="size-3.5 text-muted-foreground" />;
    if (sortDirection === 'asc') return <ChevronUp className="size-3.5" />;
    return <ChevronDown className="size-3.5" />;
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Importar pago cliente
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col items-center justify-center gap-4 p-12 text-center border-2 border-dashed rounded-lg">
            <Upload className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Sube el archivo Excel (.xlsx) con las columnas Referencia, Monto, Detalle y Fecha de Pago.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
              }}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isLoadingFile}>
              {isLoadingFile ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Seleccionar archivo
            </Button>
            <Button variant="link" size="sm" onClick={downloadClientPaymentTemplate} className="gap-1">
              <Download className="size-3.5" />
              Descargar plantilla
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col flex-1 min-h-0 gap-4 overflow-hidden">
            {isValidating ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Validando facturas contra el sistema...</p>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">Archivo: {filename}</div>
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por NF o Nro. Fiscal..."
                    className="pl-9 w-full"
                  />
                </div>
                <div className="overflow-auto flex-1 border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {SORTABLE_COLUMNS_BEFORE_FECHA.map((column) => (
                          <TableHead key={column.key} className={column.className}>
                            <button
                              type="button"
                              onClick={() => handleSortClick(column.key)}
                              className={`inline-flex items-center gap-1 hover:text-foreground ${column.className === 'text-right' ? 'flex-row-reverse' : ''}`}
                            >
                              {column.label}
                              {renderSortIcon(column.key)}
                            </button>
                          </TableHead>
                        ))}
                        <TableHead>Fecha de Pago</TableHead>
                        {SORTABLE_COLUMNS_AFTER_FECHA.map((column) => (
                          <TableHead key={column.key} className={column.className}>
                            <button
                              type="button"
                              onClick={() => handleSortClick(column.key)}
                              className={`inline-flex items-center gap-1 hover:text-foreground ${column.className === 'text-right' ? 'flex-row-reverse' : ''}`}
                            >
                              {column.label}
                              {renderSortIcon(column.key)}
                            </button>
                          </TableHead>
                        ))}
                        <TableHead>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-muted-foreground">Incluir</span>
                            <Checkbox
                              checked={masterCheckedState}
                              disabled={eligibleRows.length === 0}
                              onCheckedChange={() => toggleAll(!allEligibleSelected)}
                            />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayRows.map((row) => (
                        <TableRow key={row.id} className={ROW_BG[row.matchStatus]}>
                          <TableCell>{row.referencia}</TableCell>
                          <TableCell>{row.invoice?.numero_fiscal ?? '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.monto)}</TableCell>
                          <TableCell>{formatFechaPago(row.fechaPago)}</TableCell>
                          <TableCell className="text-right">
                            {row.invoice ? formatCurrency(row.invoice.remaining_amount) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE[row.matchStatus].variant}>
                              {STATUS_BADGE[row.matchStatus].label}
                              {row.matchStatus === 'partial_mismatch' && row.invoice
                                ? ` (${formatCurrency(row.monto - row.invoice.remaining_amount)})`
                                : ''}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={isIncluirChecked(row)}
                              disabled={!canEditIncluir(row)}
                              onCheckedChange={(checked) => toggleIncluir(row.id, checked === true)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Card>
                  <CardContent className="p-4 text-sm">
                    A conciliar: {includedRows.length} facturas — {formatCurrency(includedTotal)} | Excluidas: {excludedCount}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
            {isImporting ? (
              <>
                <Loader2 className="size-10 animate-spin text-muted-foreground" />
                <p className="text-sm">Procesando {progress.current} de {progress.total}...</p>
                <Progress value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} className="w-full max-w-sm" />
              </>
            ) : (
              <>
                <CheckCircle2 className="size-10 text-success" />
                <p className="text-sm">Importación finalizada.</p>
                {importErrors.length > 0 && (
                  <div className="w-full max-w-md text-left space-y-1 max-h-40 overflow-auto border rounded p-2">
                    {importErrors.map((err) => (
                      <div key={err.referencia} className="flex items-center gap-2 text-xs text-destructive">
                        <XCircle className="size-3.5" />
                        NF-{err.referencia}: {err.error}
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={handleClose}>Cerrar</Button>
              </>
            )}
          </div>
        )}

        {step === 2 && !isValidating && (
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              ← Volver
            </Button>
            <Button type="button" onClick={handleConfirmImport} disabled={includedRows.length === 0}>
              Confirmar importación →
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
