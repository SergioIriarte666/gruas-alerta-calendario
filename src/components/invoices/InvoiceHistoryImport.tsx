
import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Loader2, UserPlus, Users, Ban } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useClients } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import {
  parseCSVFile,
  parseXLSXFile,
  processInvoiceRows,
  ImportPreview,
  UnmatchedClient,
  ProcessedInvoice,
} from '@/utils/invoiceHistoryParser';
import { Client } from '@/types';

interface InvoiceHistoryImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const formatCLP = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

// Shared RUT normalization — strips dots, spaces, dashes
const normalizeRut = (rut: string): string =>
  rut.replace(/[.\s-]/g, '').trim().toUpperCase();

const InvoiceHistoryImport: React.FC<InvoiceHistoryImportProps> = ({ open, onOpenChange, onImportComplete }) => {
  const { clients, createClient } = useClients();
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [unmatchedClients, setUnmatchedClients] = useState<UnmatchedClient[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  const resetState = () => {
    setStep('upload');
    setPreview(null);
    setUnmatchedClients([]);
    setImporting(false);
    setImportResult(null);
    setFileName('');
    setSelectedInvoices(new Set());
  };

  // Initialize selection when preview changes
  useEffect(() => {
    if (preview) {
      const allKeys = new Set<string>();
      preview.matched.forEach((inv, i) => allKeys.add(`matched-${inv.folio}-${i}`));
      preview.unmatched.forEach((inv, i) => allKeys.add(`unmatched-${inv.folio}-${i}`));
      setSelectedInvoices(allKeys);
    }
  }, [preview]);

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      const rows = isCSV ? await parseCSVFile(file) : await parseXLSXFile(file);

      if (rows.length === 0) {
        toast.error('Archivo vacío', { description: 'No se encontraron datos en el archivo.' });
        return;
      }

      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('numero_fiscal')
        .not('numero_fiscal', 'is', null);

      const existingNumeros = new Set<string>(
        (existingInvoices || []).map((inv: any) => inv.numero_fiscal).filter(Boolean)
      );

      const result = processInvoiceRows(rows, clients, existingNumeros);
      setPreview(result);
      setUnmatchedClients(result.unmatchedClients);
      setStep('preview');

      toast.success('Archivo procesado', {
        description: `${result.totalInvoices} facturas detectadas, ${result.skippedNonFactura} documentos no-factura omitidos.`,
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Error al procesar archivo', { description: 'Verifique el formato del archivo.' });
    }
  }, [clients]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const handleClientResolution = (index: number, resolution: 'create' | 'assign' | 'ignore', assignedClientId?: string) => {
    setUnmatchedClients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], resolution, assignedClientId };
      return updated;
    });
  };

  const toggleInvoice = (key: string) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllMatched = (checked: boolean) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      preview?.matched.forEach((inv, i) => {
        const key = `matched-${inv.folio}-${i}`;
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const toggleAllUnmatched = (checked: boolean) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      preview?.unmatched.forEach((inv, i) => {
        const key = `unmatched-${inv.folio}-${i}`;
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const getSelectedMatchedCount = () => {
    if (!preview) return 0;
    return preview.matched.filter((inv, i) => selectedInvoices.has(`matched-${inv.folio}-${i}`)).length;
  };

  const getSelectedUnmatchedCount = () => {
    if (!preview) return 0;
    return preview.unmatched.filter((inv, i) => {
      const key = `unmatched-${inv.folio}-${i}`;
      if (!selectedInvoices.has(key)) return false;
      const nRut = normalizeRut(inv.rut);
      const uc = unmatchedClients.find(c => normalizeRut(c.rut) === nRut);
      return uc?.resolution !== 'ignore';
    }).length;
  };

  const canImport = () => {
    if (!preview) return false;
    const hasPending = unmatchedClients.some(c => c.resolution === 'pending');
    if (hasPending) return false;
    return (getSelectedMatchedCount() + getSelectedUnmatchedCount()) > 0;
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    setStep('importing');

    let imported = 0;
    let errors = 0;

    try {
      // Step 1: Create clients that need to be created
      const clientRutToId = new Map<string, string>();
      
      for (const uc of unmatchedClients) {
        const nRut = normalizeRut(uc.rut);
        
        if (uc.resolution === 'create') {
          try {
            const result = await createClient({
              name: uc.razonSocial,
              rut: uc.rut,
              department: 'General',
              isActive: true,
              billingType: 'standard',
              phone: '',
              email: '',
              address: '',
              contactName: '',
            } as any);
            if (result.clients && result.clients.length > 0) {
              clientRutToId.set(nRut, result.clients[0].id);
            }
          } catch (err) {
            console.error('Error creating client:', uc.rut, err);
            errors++;
          }
        } else if (uc.resolution === 'assign' && uc.assignedClientId) {
          clientRutToId.set(nRut, uc.assignedClientId);
        }
      }

      // Step 2: Build invoices to insert (only selected ones)
      const invoicesToInsert: any[] = [];

      // Add selected matched invoices
      for (let i = 0; i < preview.matched.length; i++) {
        const inv = preview.matched[i];
        const key = `matched-${inv.folio}-${i}`;
        if (!selectedInvoices.has(key)) continue;

        invoicesToInsert.push({
          folio: inv.folio,
          numero_fiscal: inv.numeroFiscal,
          client_id: inv.clientId,
          issue_date: inv.issueDate,
          due_date: inv.dueDate || inv.issueDate,
          subtotal: inv.subtotal,
          vat: inv.iva,
          total: inv.total,
          status: inv.status,
          paid_amount: inv.isPaid ? inv.total : 0,
          remaining_amount: inv.isPaid ? 0 : inv.total,
          payment_date: inv.isPaid ? inv.issueDate : null,
          notes: inv.notes,
        });
      }

      // Add selected unmatched invoices that have been resolved
      for (let i = 0; i < preview.unmatched.length; i++) {
        const inv = preview.unmatched[i];
        const key = `unmatched-${inv.folio}-${i}`;
        if (!selectedInvoices.has(key)) continue;

        const nRut = normalizeRut(inv.rut);
        const clientId = clientRutToId.get(nRut);
        
        const ucEntry = unmatchedClients.find(uc => normalizeRut(uc.rut) === nRut);
        
        if (ucEntry?.resolution === 'ignore') continue;
        if (!clientId) continue;

        invoicesToInsert.push({
          folio: inv.folio,
          numero_fiscal: inv.numeroFiscal,
          client_id: clientId,
          issue_date: inv.issueDate,
          due_date: inv.dueDate || inv.issueDate,
          subtotal: inv.subtotal,
          vat: inv.iva,
          total: inv.total,
          status: inv.status,
          paid_amount: inv.isPaid ? inv.total : 0,
          remaining_amount: inv.isPaid ? 0 : inv.total,
          payment_date: inv.isPaid ? inv.issueDate : null,
          notes: inv.notes,
        });
      }

      // Step 3: Insert in batches of 50
      const batchSize = 50;
      for (let i = 0; i < invoicesToInsert.length; i += batchSize) {
        const batch = invoicesToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from('invoices').insert(batch);
        if (error) {
          console.error('Batch insert error:', error);
          errors += batch.length;
        } else {
          imported += batch.length;
        }
      }

      setImportResult({ imported, errors });
      setStep('done');

      if (errors === 0) {
        toast.success('Importación completada', {
          description: `${imported} facturas importadas exitosamente.`,
        });
      } else {
        toast.warning('Importación con errores', {
          description: `${imported} importadas, ${errors} con errores.`,
        });
      }

      onImportComplete();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Error en la importación');
      setImportResult({ imported, errors: errors + 1 });
      setStep('done');
    } finally {
      setImporting(false);
    }
  };

  const totalToImport = getSelectedMatchedCount() + getSelectedUnmatchedCount();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Historial de Facturas
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">
              {isDragActive ? 'Suelta el archivo aquí...' : 'Arrastra tu archivo CSV o XLSX'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Archivo de reporte de ventas del sistema de facturación
            </p>
            <Button variant="outline" className="mt-4">
              Seleccionar archivo
            </Button>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{preview.totalInvoices}</p>
                  <p className="text-xs text-muted-foreground">Facturas detectadas</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-500">{preview.matched.length}</p>
                  <p className="text-xs text-muted-foreground">Con cliente</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{preview.unmatched.length}</p>
                  <p className="text-xs text-muted-foreground">Sin cliente</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{preview.duplicates.length}</p>
                  <p className="text-xs text-muted-foreground">Duplicados</p>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{formatCLP(preview.totalAmount)}</span>
                {preview.skippedNonFactura > 0 && (
                  <> — {preview.skippedNonFactura} documentos no-factura omitidos</>
                )}
              </div>

              {/* Unmatched clients section */}
              {unmatchedClients.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Clientes no encontrados ({unmatchedClients.length})
                    </h3>
                    <div className="space-y-3">
                      {unmatchedClients.map((uc, index) => (
                        <div key={uc.rut} className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{uc.razonSocial}</p>
                              <p className="text-xs text-muted-foreground">
                                RUT: {uc.rut} — {uc.invoiceCount} factura{uc.invoiceCount !== 1 ? 's' : ''} — {formatCLP(uc.totalAmount)}
                              </p>
                            </div>
                            <ResolutionBadge resolution={uc.resolution} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={uc.resolution === 'create' ? 'default' : 'outline'}
                              onClick={() => handleClientResolution(index, 'create')}
                              className="text-xs gap-1"
                            >
                              <UserPlus className="h-3 w-3" />
                              Crear cliente
                            </Button>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={uc.resolution === 'assign' ? 'default' : 'outline'}
                                onClick={() => {
                                  if (uc.resolution !== 'assign') {
                                    handleClientResolution(index, 'assign');
                                  }
                                }}
                                className="text-xs gap-1"
                              >
                                <Users className="h-3 w-3" />
                                Asignar
                              </Button>
                              {uc.resolution === 'assign' && (
                                <Select
                                  value={uc.assignedClientId || ''}
                                  onValueChange={(val) => handleClientResolution(index, 'assign', val)}
                                >
                                  <SelectTrigger className="w-[200px] h-8 text-xs">
                                    <SelectValue placeholder="Seleccionar cliente..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {clients.filter(c => c.isActive).map(c => (
                                      <SelectItem key={c.id} value={c.id} className="text-xs">
                                        {c.name} ({c.rut})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={uc.resolution === 'ignore' ? 'destructive' : 'outline'}
                              onClick={() => handleClientResolution(index, 'ignore')}
                              className="text-xs gap-1"
                            >
                              <Ban className="h-3 w-3" />
                              Ignorar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Matched invoices preview */}
              {preview.matched.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Facturas listas para importar ({getSelectedMatchedCount()}/{preview.matched.length})
                      </h3>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Checkbox
                          checked={getSelectedMatchedCount() === preview.matched.length}
                          onCheckedChange={(checked) => toggleAllMatched(!!checked)}
                        />
                        Seleccionar todas
                      </label>
                    </div>
                    <ScrollArea className="max-h-[250px]">
                      <InvoicePreviewTable
                        invoices={preview.matched}
                        selectedKeys={selectedInvoices}
                        keyPrefix="matched"
                        onToggle={toggleInvoice}
                      />
                    </ScrollArea>
                  </div>
                </>
              )}

              {/* Duplicates */}
              {preview.duplicates.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      Duplicados detectados — se omitirán ({preview.duplicates.length})
                    </h3>
                    <InvoicePreviewTable invoices={preview.duplicates.slice(0, 5)} />
                  </div>
                </>
              )}
            </div>
            </div>

            {/* Action buttons — fixed at bottom */}
            <div className="flex justify-end gap-2 pt-4 border-t mt-4 flex-shrink-0">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={!canImport()}
                className="gap-2"
              >
                {!canImport() && <AlertTriangle className="h-4 w-4" />}
                Importar {totalToImport} factura{totalToImport !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium text-foreground">Importando facturas...</p>
            <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos</p>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium text-foreground">Importación completada</p>
            <p className="text-sm text-muted-foreground mt-2">
              {importResult.imported} facturas importadas
              {importResult.errors > 0 && `, ${importResult.errors} con errores`}
            </p>
            <Button onClick={handleClose} className="mt-6">
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Sub-components
const ResolutionBadge: React.FC<{ resolution: string }> = ({ resolution }) => {
  switch (resolution) {
    case 'create':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Crear nuevo</Badge>;
    case 'assign':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Asignar existente</Badge>;
    case 'ignore':
      return <Badge variant="secondary">Ignorar</Badge>;
    default:
      return <Badge variant="outline" className="text-amber-500 border-amber-500/30">Pendiente</Badge>;
  }
};

interface InvoicePreviewTableProps {
  invoices: ProcessedInvoice[];
  selectedKeys?: Set<string>;
  keyPrefix?: string;
  onToggle?: (key: string) => void;
}

const InvoicePreviewTable: React.FC<InvoicePreviewTableProps> = ({ invoices, selectedKeys, keyPrefix, onToggle }) => (
  <Table>
    <TableHeader>
      <TableRow>
        {onToggle && <TableHead className="w-[40px]"></TableHead>}
        <TableHead className="text-xs">Folio</TableHead>
        <TableHead className="text-xs">Cliente</TableHead>
        <TableHead className="text-xs">Fecha</TableHead>
        <TableHead className="text-xs text-right">Total</TableHead>
        <TableHead className="text-xs">Estado</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {invoices.map((inv, i) => {
        const key = keyPrefix ? `${keyPrefix}-${inv.folio}-${i}` : `${inv.folio}-${i}`;
        const isSelected = selectedKeys ? selectedKeys.has(key) : true;
        return (
          <TableRow key={key} className={!isSelected ? 'opacity-40' : ''}>
            {onToggle && (
              <TableCell className="pr-0">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(key)}
                />
              </TableCell>
            )}
            <TableCell className="text-xs font-medium">{inv.numeroFiscal}</TableCell>
            <TableCell className="text-xs truncate max-w-[200px]">{inv.razonSocial}</TableCell>
            <TableCell className="text-xs">{inv.issueDate}</TableCell>
            <TableCell className="text-xs text-right">{formatCLP(inv.total)}</TableCell>
            <TableCell>
              <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px]">
                {inv.status === 'paid' ? 'Pagada' : inv.status === 'overdue' ? 'Vencida' : 'Enviada'}
              </Badge>
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);

export default InvoiceHistoryImport;
