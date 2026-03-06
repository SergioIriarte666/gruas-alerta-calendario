
import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Loader2, UserPlus, Users, Ban, Edit2, Sparkles, Trash2, ArrowRight } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useClients } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { stringSimilarity, toTitleCase } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  parseCSVFile,
  parseXLSXFile,
  processInvoiceRows,
  ImportPreview,
  UnmatchedClient,
  ProcessedInvoice,
  DocumentType,
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

const normalizeRut = (rut: string): string =>
  rut.replace(/[^0-9Kk]/g, '').trim().toUpperCase();

const formatClientWithDepartment = (client: Client): string => {
  const department = client.department?.trim();
  const name = toTitleCase(client.name);
  if (department && department.toLowerCase() !== 'general') {
    return `${name} (${client.rut}) — ${department}`;
  }
  return `${name} (${client.rut})`;
};

const InvoiceHistoryImport: React.FC<InvoiceHistoryImportProps> = ({ open, onOpenChange, onImportComplete }) => {
  const { clients, createClient } = useClients();
  const [step, setStep] = useState<Step>('upload');
  const [activeTab, setActiveTab] = useState('matched');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [unmatchedClients, setUnmatchedClients] = useState<UnmatchedClient[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedUnmatchedClientIndices, setSelectedUnmatchedClientIndices] = useState<Set<number>>(new Set());
  const [editingClientIndex, setEditingClientIndex] = useState<number | null>(null);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkAssignClientId, setBulkAssignClientId] = useState<string>('');
  const [editClientForm, setEditClientForm] = useState<{
    name: string;
    address: string;
    email: string;
  }>({ name: '', address: '', email: '' });

  const resetState = () => {
    setStep('upload');
    setPreview(null);
    setUnmatchedClients([]);
    setImporting(false);
    setImportResult(null);
    setFileName('');
    setSelectedInvoices(new Set());
    setSelectedUnmatchedClientIndices(new Set());
    setEditingClientIndex(null);
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

  // Compute suggestions when unmatched clients are set
  useEffect(() => {
    if (unmatchedClients.length > 0 && clients.length > 0) {
      // Only compute if not already computed (optimization)
      const needsComputation = unmatchedClients.some(uc => !uc.suggestion && uc.resolution === 'pending');
      
      if (needsComputation) {
        setUnmatchedClients(prev => {
          return prev.map(uc => {
            if (uc.suggestion || uc.resolution !== 'pending') return uc;
            
            // Find best match
            let bestMatch = { clientId: '', name: '', score: 0 };
            
            for (const client of clients) {
              const score = stringSimilarity(uc.razonSocial.toLowerCase(), client.name.toLowerCase());
              if (score > bestMatch.score) {
                bestMatch = { clientId: client.id, name: client.name, score };
              }
            }
            
            // Threshold for suggestion (e.g., 0.6)
            if (bestMatch.score > 0.6) {
              return { ...uc, suggestion: bestMatch };
            }
            
            return uc;
          });
        });
      }
    }
  }, [unmatchedClients.length, clients.length]);

  const toggleUnmatchedClientSelection = (index: number) => {
    setSelectedUnmatchedClientIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllUnmatchedClients = (checked: boolean) => {
    if (checked) {
      const allIndices = new Set<number>();
      unmatchedClients.forEach((_, i) => allIndices.add(i));
      setSelectedUnmatchedClientIndices(allIndices);
    } else {
      setSelectedUnmatchedClientIndices(new Set());
    }
  };

  const handleBulkAction = (action: 'create' | 'assign' | 'ignore', assignedClientId?: string) => {
    if (selectedUnmatchedClientIndices.size === 0) {
      toast.error("Seleccione al menos un cliente");
      return;
    }

    setUnmatchedClients(prev => {
      return prev.map((uc, i) => {
        if (selectedUnmatchedClientIndices.has(i)) {
          return { ...uc, resolution: action, assignedClientId };
        }
        return uc;
      });
    });
    // Clear selection after action
    setSelectedUnmatchedClientIndices(new Set());
    toast.success(`Acción aplicada a ${selectedUnmatchedClientIndices.size} clientes`);
  };

  const handleBulkAssign = () => {
    if (selectedUnmatchedClientIndices.size === 0) {
      toast.error("Seleccione al menos un cliente");
      return;
    }
    setBulkAssignDialogOpen(true);
  };

  const confirmBulkAssign = () => {
    if (!bulkAssignClientId) {
      toast.error("Seleccione un cliente para asignar");
      return;
    }
    handleBulkAction('assign', bulkAssignClientId);
    setBulkAssignDialogOpen(false);
    setBulkAssignClientId('');
  };

  const applySuggestion = (index: number) => {
    const uc = unmatchedClients[index];
    if (uc.suggestion) {
      handleClientResolution(index, 'assign', uc.suggestion.clientId);
      toast.success('Sugerencia aceptada');
    }
  };

  const openQuickEdit = (index: number) => {
    const uc = unmatchedClients[index];
    setEditingClientIndex(index);
    setEditClientForm({
      name: uc.razonSocial,
      address: uc.address || '',
      email: uc.email || '',
    });
  };

  const saveQuickEdit = () => {
    if (editingClientIndex === null) return;
    
    setUnmatchedClients(prev => {
      const updated = [...prev];
      updated[editingClientIndex] = {
        ...updated[editingClientIndex],
        razonSocial: editClientForm.name,
        address: editClientForm.address,
        email: editClientForm.email,
        resolution: 'create' // Auto-set to create after edit
      };
      return updated;
    });
    
    setEditingClientIndex(null);
    toast.success('Cliente actualizado');
  };

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
      
      // Auto-switch to unmatched tab if there are unmatched clients
      if (result.unmatchedClients.length > 0) {
        setActiveTab('unmatched');
      }

      const parts = [`${result.facturaCount} facturas`];
      if (result.creditNoteCount > 0) parts.push(`${result.creditNoteCount} NC`);
      if (result.debitNoteCount > 0) parts.push(`${result.debitNoteCount} ND`);
      toast.success('Archivo procesado', {
        description: `${result.totalInvoices} documentos detectados: ${parts.join(', ')}.`,
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
      return !!uc && uc.resolution !== 'ignore' && uc.resolution !== 'pending';
    }).length;
  };

  const canImport = () => {
    if (!preview) return false;
    return (getSelectedMatchedCount() + getSelectedUnmatchedCount()) > 0;
  };

  const handleImport = async () => {
    if (!preview) return;

    setStep('importing');
    setImporting(true);
    setLastError(null);

    let imported = 0;
    let errors = 0;
    const totalItems = invoicesToInsertCount();
    let currentProgress = 0;

    const updateProgress = (count: number) => {
        currentProgress += count;
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      if (!userId) {
        throw new Error('No se pudo obtener el usuario actual. Inicie sesión nuevamente.');
      }

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
              email: uc.email || '',
              address: uc.address || '',
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

        if (!inv.issueDate) {
          console.error('Factura omitida por fecha inválida:', inv);
          errors++;
          continue;
        }

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
          payment_date: inv.isPaid ? inv.issueDate : null,
          notes: inv.notes,
          created_by: userId,
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
        if (!clientId) {
            console.error('Factura omitida por falta de cliente:', inv);
            errors++;
            continue;
        }
        if (!inv.issueDate) {
          console.error('Factura omitida por fecha inválida:', inv);
          errors++;
          continue;
        }

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
          payment_date: inv.isPaid ? inv.issueDate : null,
          notes: inv.notes,
          created_by: userId,
        });
      }

      // Step 3: Insert in batches of 50
      if (invoicesToInsert.length === 0 && errors > 0) {
          toast.error("No se pudieron preparar facturas para importar", {
              description: "Verifique que las fechas y clientes sean válidos."
          });
          setLastError("No se pudieron preparar facturas. Verifique fechas y clientes.");
          setImportResult({ imported: 0, errors });
          setStep('done');
          return;
      }

      const batchSize = 50;
      for (let i = 0; i < invoicesToInsert.length; i += batchSize) {
        const batch = invoicesToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from('invoices').insert(batch);
        
        if (error) {
          console.error('Batch insert error:', error);
          errors += batch.length;
          const msg = error.message || 'Error desconocido al insertar facturas';
          setLastError(msg);
          toast.error(`Error en lote ${Math.floor(i/batchSize) + 1}`, {
              description: msg
          });
        } else {
          imported += batch.length;
        }
        updateProgress(batch.length);
      }

      setImportResult({ imported, errors });
      setStep('done');

      if (errors === 0) {
        toast.success('Importación completada', {
          description: `${imported} facturas importadas exitosamente.`,
        });
      } else {
        toast.warning('Importación con errores', {
          description: `Se importaron ${imported} facturas, pero ${errors} fallaron.`,
        });
      }

      if (imported > 0) {
          onImportComplete();
      }
    } catch (err: any) {
      console.error('Import error:', err);
      const msg = err.message || 'Error desconocido durante la importación';
      setLastError(msg);
      toast.error('Error durante la importación', {
        description: msg,
      });
      setImportResult({ imported: imported, errors: errors || totalItems });
      setStep('done');
    } finally {
      setImporting(false);
    }
  };

  const invoicesToInsertCount = () => {
      return getSelectedMatchedCount() + getSelectedUnmatchedCount();
  };

  const totalToImport = getSelectedMatchedCount() + getSelectedUnmatchedCount();

  return (
    <>
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
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-none px-1 py-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{preview.totalInvoices}</p>
                  <p className="text-xs text-muted-foreground">Documentos detectados</p>
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

              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  Total: <span className="font-semibold text-foreground">{formatCLP(preview.totalAmount)}</span>
                  {preview.skippedNonFactura > 0 && (
                    <> — {preview.skippedNonFactura} documentos omitidos</>
                  )}
                </div>
                {(preview.creditNoteCount > 0 || preview.debitNoteCount > 0) && (
                  <div className="flex gap-3 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {preview.facturaCount} Facturas
                    </Badge>
                    {preview.creditNoteCount > 0 && (
                      <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">
                        {preview.creditNoteCount} Notas de Crédito
                      </Badge>
                    )}
                    {preview.debitNoteCount > 0 && (
                      <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">
                        {preview.debitNoteCount} Notas de Débito
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
              <div className="flex-none px-1 mb-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="matched">
                    Listas para importar ({preview.matched.length})
                  </TabsTrigger>
                  <TabsTrigger value="unmatched" className="relative">
                    Sin Cliente ({preview.unmatched.length})
                    {preview.unmatched.length > 0 && (
                      <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="duplicates">
                    Duplicados ({preview.duplicates.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden border rounded-md bg-muted/10">
                <TabsContent value="matched" className="h-full mt-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {preview.matched.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Facturas listas ({getSelectedMatchedCount()}/{preview.matched.length})
                            </h3>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={getSelectedMatchedCount() === preview.matched.length && preview.matched.length > 0}
                                onCheckedChange={(checked) => toggleAllMatched(!!checked)}
                              />
                              Seleccionar todas
                            </label>
                          </div>
                          <InvoicePreviewTable
                            invoices={preview.matched}
                            selectedKeys={selectedInvoices}
                            keyPrefix="matched"
                            onToggle={toggleInvoice}
                          />
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No hay facturas listas para importar. Revisa la pestaña "Sin Cliente".
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="unmatched" className="h-full mt-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {unmatchedClients.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              Clientes no encontrados ({unmatchedClients.length}) — {preview.unmatched.length} facturas
                            </h3>
                          </div>

                          {/* Bulk Actions Toolbar */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 p-3 bg-card border rounded-md">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={selectedUnmatchedClientIndices.size === unmatchedClients.length && unmatchedClients.length > 0}
                                    onCheckedChange={(checked) => selectAllUnmatchedClients(!!checked)}
                                />
                                <span className="text-sm font-medium">
                                    {selectedUnmatchedClientIndices.size} seleccionados
                                </span>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 text-xs flex-1 sm:flex-none"
                                    onClick={() => handleBulkAction('create')}
                                    disabled={selectedUnmatchedClientIndices.size === 0}
                                >
                                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                                    Crear
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 text-xs flex-1 sm:flex-none"
                                    onClick={handleBulkAssign}
                                    disabled={selectedUnmatchedClientIndices.size === 0}
                                >
                                    <Users className="h-3.5 w-3.5 mr-1" />
                                    Asignar
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 text-xs flex-1 sm:flex-none"
                                    onClick={() => handleBulkAction('ignore')}
                                    disabled={selectedUnmatchedClientIndices.size === 0}
                                >
                                    <Ban className="h-3.5 w-3.5 mr-1" />
                                    Ignorar
                                </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-3 mb-6">
                            {unmatchedClients.map((uc, index) => (
                              <div key={uc.rut} className={`border rounded-lg p-3 bg-card transition-colors ${selectedUnmatchedClientIndices.has(index) ? 'border-primary/50 bg-primary/5' : ''}`}>
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-3">
                                        <Checkbox 
                                            checked={selectedUnmatchedClientIndices.has(index)}
                                            onCheckedChange={() => toggleUnmatchedClientSelection(index)}
                                            className="mt-1"
                                        />
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-medium text-foreground">{toTitleCase(uc.razonSocial)}</p>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openQuickEdit(index)}
                                                    title="Editar datos del cliente"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                            RUT: {uc.rut} — {uc.invoiceCount} factura{uc.invoiceCount !== 1 ? 's' : ''} — {formatCLP(uc.totalAmount)}
                                            </p>
                                            {(uc.email || uc.address) && (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {uc.email && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded flex items-center gap-1">📧 {uc.email}</span>}
                                                {uc.address && <span className="text-[10px] bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded flex items-center gap-1">📍 {toTitleCase(uc.address)}</span>}
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                    <ResolutionBadge resolution={uc.resolution} />
                                  </div>

                                  {/* Suggestions Area */}
                                  {uc.suggestion && uc.resolution === 'pending' && (
                                      <div className="ml-8 p-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 rounded flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-400">
                                              <Sparkles className="h-3.5 w-3.5" />
                                              <span>Sugerencia: <strong>{uc.suggestion.name}</strong> ({(uc.suggestion.score * 100).toFixed(0)}%)</span>
                                          </div>
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-6 text-xs hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700"
                                            onClick={() => applySuggestion(index)}
                                          >
                                              Aplicar
                                          </Button>
                                      </div>
                                  )}

                                  <div className="flex flex-wrap gap-2 ml-8">
                                    <Button
                                      size="sm"
                                      variant={uc.resolution === 'create' ? 'default' : 'outline'}
                                      onClick={() => handleClientResolution(index, 'create')}
                                      className="text-xs gap-1 h-8"
                                    >
                                      <UserPlus className="h-3 w-3" />
                                      Crear
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
                                        className="text-xs gap-1 h-8"
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
                                                {formatClientWithDepartment(c)}
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
                                      className="text-xs gap-1 h-8"
                                    >
                                      <Ban className="h-3 w-3" />
                                      Ignorar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {preview.unmatched.length > 0 && (
                            <>
                              <div className="flex items-center justify-between mb-3 pt-4 border-t">
                                <h3 className="text-sm font-semibold text-foreground">
                                  Detalle de facturas sin cliente ({getSelectedUnmatchedCount()}/{preview.unmatched.length})
                                </h3>
                                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                                  <Checkbox
                                    checked={getSelectedUnmatchedCount() === preview.unmatched.length && preview.unmatched.length > 0}
                                    onCheckedChange={(checked) => toggleAllUnmatched(!!checked)}
                                  />
                                  Seleccionar todas
                                </label>
                              </div>
                              <InvoicePreviewTable
                                invoices={preview.unmatched}
                                selectedKeys={selectedInvoices}
                                keyPrefix="unmatched"
                                onToggle={toggleInvoice}
                              />
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No hay clientes sin identificar. ¡Excelente!
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="duplicates" className="h-full mt-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {preview.duplicates.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                              Duplicados detectados — se omitirán ({preview.duplicates.length})
                            </h3>
                          </div>
                          <InvoicePreviewTable invoices={preview.duplicates} />
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No se encontraron facturas duplicadas.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4 flex-none bg-background z-10">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={!canImport()}
                className="gap-2"
              >
                {!canImport() && <AlertTriangle className="h-4 w-4" />}
                Importar {totalToImport} documento{totalToImport !== 1 ? 's' : ''}
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
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            {importResult.errors > 0 && importResult.imported === 0 ? (
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            ) : (
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            )}
            
            <p className="text-lg font-medium text-foreground">
                {importResult.errors > 0 && importResult.imported === 0 
                    ? 'Error en la importación' 
                    : 'Importación completada'}
            </p>
            
            <p className="text-sm text-muted-foreground mt-2">
              {importResult.imported} facturas importadas
              {importResult.errors > 0 && `, ${importResult.errors} con errores`}
            </p>
            
            {lastError && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md max-w-md break-words">
                    {lastError}
                </div>
            )}

            <Button onClick={handleClose} className="mt-6">
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Bulk Assign Dialog */}
    <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Clientes en Lote</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Seleccione el cliente al que desea asignar los {selectedUnmatchedClientIndices.size} registros seleccionados.
          </p>
          <div className="space-y-2">
            <Label htmlFor="bulk-assign-client">Cliente Existente</Label>
            <Select
              value={bulkAssignClientId}
              onValueChange={setBulkAssignClientId}
            >
              <SelectTrigger id="bulk-assign-client">
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.filter(c => c.isActive).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {formatClientWithDepartment(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>Cancelar</Button>
          <Button onClick={confirmBulkAssign}>Confirmar Asignación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Quick Edit Dialog */}
    <Dialog open={editingClientIndex !== null} onOpenChange={(open) => !open && setEditingClientIndex(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Razón Social</Label>
            <Input 
              id="name" 
              value={editClientForm.name} 
              onChange={(e) => setEditClientForm(prev => ({ ...prev, name: e.target.value }))} 
              onBlur={() => setEditClientForm(prev => ({ ...prev, name: toTitleCase(prev.name) }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input 
              id="address" 
              value={editClientForm.address} 
              onChange={(e) => setEditClientForm(prev => ({ ...prev, address: e.target.value }))} 
              onBlur={() => setEditClientForm(prev => ({ ...prev, address: toTitleCase(prev.address) }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email"
              value={editClientForm.email} 
              onChange={(e) => setEditClientForm(prev => ({ ...prev, email: e.target.value }))} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditingClientIndex(null)}>Cancelar</Button>
          <Button onClick={saveQuickEdit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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

const DocTypeBadge: React.FC<{ type: DocumentType }> = ({ type }) => {
  switch (type) {
    case 'nota_credito':
      return <Badge variant="outline" className="text-[9px] border-red-300 text-red-600">NC</Badge>;
    case 'nota_debito':
      return <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-600">ND</Badge>;
    default:
      return <Badge variant="outline" className="text-[9px]">F</Badge>;
  }
};

const InvoicePreviewTable: React.FC<InvoicePreviewTableProps> = ({ invoices, selectedKeys, keyPrefix, onToggle }) => (
  <Table>
    <TableHeader>
      <TableRow>
        {onToggle && <TableHead className="w-[40px]"></TableHead>}
        <TableHead className="text-xs">Tipo</TableHead>
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
            <TableCell className="text-xs">
              <DocTypeBadge type={inv.documentType} />
            </TableCell>
            <TableCell className="text-xs font-medium">{inv.numeroFiscal}</TableCell>
            <TableCell className="text-xs truncate max-w-[200px]">{toTitleCase(inv.razonSocial)}</TableCell>
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
