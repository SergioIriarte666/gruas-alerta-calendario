
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Loader2, UserPlus, Users, Ban, Edit2, Sparkles, RotateCw, FileSpreadsheet, CalendarRange } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useClients } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { stringSimilarity, toTitleCase } from '@/lib/utils';
import { normalizeProductServiceDescription } from '@/utils/validationUtils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useImportMappings, type ImportMappingResolution } from '@/hooks/useImportMappings';
import { useImportHistoryLog, type ImportHistoryLogEntry } from '@/hooks/useImportHistoryLog';
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
import { createLogger } from "@/lib/logger";


const logger = createLogger("InvoiceHistoryImport");
interface InvoiceHistoryImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

type ResolvedUnmatchedClient = UnmatchedClient & {
  autoResolvedByMapping?: boolean;
  mappingSourceResolution?: ImportMappingResolution;
};

const formatCLP = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const normalizeRut = (rut: string): string =>
  rut.replace(/[^0-9Kk]/g, '').trim().toUpperCase();

const rutCandidates = (rut: string): string[] => {
  const n = normalizeRut(rut);
  if (!n) return [''];
  if (n.length === 1) return [n];
  const base = n.slice(0, -1);
  return n === base ? [n] : [n, base];
};

const rutMatches = (a: string, b: string): boolean => {
  const aC = rutCandidates(a);
  const bC = new Set(rutCandidates(b));
  return aC.some((c) => bC.has(c));
};

const formatClientWithDepartment = (client: Client): string => {
  const department = client.department?.trim();
  const name = toTitleCase(client.name);
  if (department && department.toLowerCase() !== 'general') {
    return `${name} (${client.rut}) — ${department}`;
  }
  return `${name} (${client.rut})`;
};

const sortUnmatchedClients = (items: ResolvedUnmatchedClient[]) =>
  [...items].sort((a, b) => b.invoiceCount - a.invoiceCount || a.razonSocial.localeCompare(b.razonSocial, 'es'));

const getPreviewDateRange = (preview: ImportPreview | null) => {
  if (!preview) {
    return { start: null as string | null, end: null as string | null };
  }

  const allDates = [...preview.matched, ...preview.unmatched, ...preview.duplicates]
    .map((invoice) => invoice.issueDate?.slice(0, 10))
    .filter(Boolean)
    .sort();

  return {
    start: allDates[0] ?? null,
    end: allDates[allDates.length - 1] ?? null,
  };
};

const InvoiceHistoryImport: React.FC<InvoiceHistoryImportProps> = ({ open, onOpenChange, onImportComplete }) => {
  const { clients, createClient } = useClients();
  const { getMappings, saveMapping } = useImportMappings('sale');
  const { logs: importLogs, getOverlappingLogs, saveLog } = useImportHistoryLog('sale', 5);
  const [step, setStep] = useState<Step>('upload');
  const [activeTab, setActiveTab] = useState('matched');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [unmatchedClients, setUnmatchedClients] = useState<ResolvedUnmatchedClient[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedUnmatchedClientIndices, setSelectedUnmatchedClientIndices] = useState<Set<number>>(new Set());
  const [editingClientIndex, setEditingClientIndex] = useState<number | null>(null);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkAssignClientId, setBulkAssignClientId] = useState<string>('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [editClientForm, setEditClientForm] = useState<{
    name: string;
    address: string;
    email: string;
  }>({ name: '', address: '', email: '' });
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [overlappingImportLog, setOverlappingImportLog] = useState<ImportHistoryLogEntry | null>(null);

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
    setProgressCurrent(0);
    setProgressTotal(0);
    setProgressStage('');
    setInstructionsOpen(importLogs.length === 0);
    setOverlappingImportLog(null);
  };

  // Initialize selection when preview changes
  useEffect(() => {
    if (preview) {
      const allKeys = new Set<string>();
      preview.matched.forEach((inv, i) => allKeys.add(`matched-${inv.folio}-${i}`));
      preview.unmatched.forEach((inv, i) => allKeys.add(`unmatched-${inv.folio}-${i}`));
      preview.duplicates.forEach((inv, i) => allKeys.add(`duplicates-${inv.folio}-${i}`));
      setSelectedInvoices(allKeys);
    }
  }, [preview]);

  useEffect(() => {
    if (!open) return;
    setInstructionsOpen(importLogs.length === 0);
  }, [open, importLogs.length]);

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
            
            // Auto-preselect strong suggestions to reduce clicks.
            if (bestMatch.score > 0.6) {
              if (bestMatch.score > 0.75) {
                return {
                  ...uc,
                  suggestion: bestMatch,
                  resolution: 'assign',
                  assignedClientId: bestMatch.clientId,
                };
              }

              return { ...uc, suggestion: bestMatch };
            }
            
            return uc;
          });
        });
      }
    }
  }, [unmatchedClients.length, clients.length]);

  useEffect(() => {
    if (activeTab !== 'unmatched') return;
    if (unmatchedClients.length === 0 || unmatchedClients.length >= 10) return;
    if (selectedUnmatchedClientIndices.size > 0) return;

    const allIndices = new Set<number>();
    unmatchedClients.forEach((_, index) => allIndices.add(index));
    setSelectedUnmatchedClientIndices(allIndices);
  }, [activeTab, unmatchedClients, selectedUnmatchedClientIndices.size]);

  const persistImportArtifacts = useCallback(
    async (imported: number, errors: number, currentPreview: ImportPreview, resolvedClients: ResolvedUnmatchedClient[]) => {
      const dateRange = getPreviewDateRange(currentPreview);
      const skippedCount = Math.max(0, currentPreview.totalInvoices - imported - errors);
      const status =
        imported === 0 ? 'failed' : errors === 0 ? 'success' : 'partial';

      try {
        await saveLog({
          importType: 'sale',
          fileName,
          importedCount: imported,
          errorCount: errors,
          skippedCount,
          dateRangeStart: dateRange.start,
          dateRangeEnd: dateRange.end,
          status,
        });
      } catch (logError) {
        logger.error('Error saving import history log:', logError);
      }

      if (imported <= 0) return;

      try {
        await Promise.all(
          resolvedClients
            .filter((client) => client.resolution !== 'pending')
            .map(async (client) => {
              const assignedClient = client.assignedClientId
                ? clients.find((existingClient) => existingClient.id === client.assignedClientId)
                : null;

              await saveMapping(
                'sale',
                client.rut,
                client.razonSocial,
                client.resolution as ImportMappingResolution,
                client.resolution === 'assign' ? client.assignedClientId ?? null : null,
                client.resolution === 'assign'
                  ? assignedClient?.name ?? client.suggestion?.name ?? null
                  : client.resolution === 'create'
                    ? client.razonSocial
                    : null
              );
            })
        );
      } catch (mappingError) {
        logger.error('Error saving import mappings:', mappingError);
      }
    },
    [clients, fileName, saveLog, saveMapping]
  );

  const resolveClientFromMapping = useCallback(
    (
      client: UnmatchedClient,
      mapping: Awaited<ReturnType<typeof getMappings>>[number] | undefined
    ): ResolvedUnmatchedClient => {
      if (!mapping) return client;

      if (mapping.resolution === 'ignore') {
        return {
          ...client,
          resolution: 'ignore',
          autoResolvedByMapping: true,
          mappingSourceResolution: mapping.resolution,
        };
      }

      if (mapping.resolution === 'assign' && mapping.mapped_entity_id) {
        return {
          ...client,
          resolution: 'assign',
          assignedClientId: mapping.mapped_entity_id,
          autoResolvedByMapping: true,
          mappingSourceResolution: mapping.resolution,
        };
      }

      const existingClient = clients.find((currentClient) => rutMatches(currentClient.rut, client.rut));
      if (existingClient) {
        return {
          ...client,
          resolution: 'assign',
          assignedClientId: existingClient.id,
          autoResolvedByMapping: true,
          mappingSourceResolution: mapping.resolution,
        };
      }

      return {
        ...client,
        resolution: 'create',
        autoResolvedByMapping: true,
        mappingSourceResolution: mapping.resolution,
      };
    },
    [clients, getMappings]
  );

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
      const nextClients = prev.map((uc, i) => {
        if (selectedUnmatchedClientIndices.has(i)) {
          return { ...uc, resolution: action, assignedClientId, autoResolvedByMapping: false };
        }
        return uc;
      });

      if (preview) {
        const keysToUpdate: string[] = [];
        preview.unmatched.forEach((inv, index) => {
          const ownerIndex = nextClients.findIndex((client) => rutMatches(client.rut, inv.rut));
          if (selectedUnmatchedClientIndices.has(ownerIndex)) {
            keysToUpdate.push(`unmatched-${inv.folio}-${index}`);
          }
        });

        setSelectedInvoices((prevSelected) => {
          const nextSelected = new Set(prevSelected);
          keysToUpdate.forEach((key) => {
            if (action === 'ignore') nextSelected.delete(key);
            else nextSelected.add(key);
          });
          return nextSelected;
        });
      }

      return nextClients;
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
        resolution: 'create',
        autoResolvedByMapping: false,
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
        .select('numero_fiscal, folio');

      const existingNumeros = new Set<string>(
        (existingInvoices || []).map((inv: any) => inv.numero_fiscal).filter(Boolean)
      );

      const existingFolios = new Set<string>(
        (existingInvoices || []).map((inv: any) => inv.folio).filter(Boolean)
      );

      const result = processInvoiceRows(rows, clients, existingNumeros, existingFolios);
      const savedMappings = await getMappings('sale');
      const mappingByRut = new Map(
        savedMappings.map((mapping) => [normalizeRut(mapping.source_rut), mapping])
      );
      const resolvedUnmatchedClients = sortUnmatchedClients(
        result.unmatchedClients.map((client) =>
          resolveClientFromMapping(client, mappingByRut.get(normalizeRut(client.rut)))
        )
      );
      const previewDateRange = getPreviewDateRange(result);
      const overlappingLogs =
        previewDateRange.start && previewDateRange.end
          ? await getOverlappingLogs('sale', previewDateRange.start, previewDateRange.end)
          : [];

      setPreview(result);
      setUnmatchedClients(resolvedUnmatchedClients);
      setOverlappingImportLog(overlappingLogs[0] ?? null);
      setStep('preview');
      
      const hasPendingClients = resolvedUnmatchedClients.some((client) => client.resolution === 'pending');
      if (hasPendingClients) {
        setActiveTab('unmatched');
      } else {
        setActiveTab('matched');
      }

      const parts = [`${result.facturaCount} facturas`];
      if (result.creditNoteCount > 0) parts.push(`${result.creditNoteCount} NC`);
      if (result.debitNoteCount > 0) parts.push(`${result.debitNoteCount} ND`);
      toast.success('Archivo procesado', {
        description: `${result.totalInvoices} documentos detectados: ${parts.join(', ')}.`,
      });
    } catch (error) {
      logger.error('Error parsing file:', error);
      toast.error('Error al procesar archivo', { description: 'Verifique el formato del archivo.' });
    }
  }, [clients, getMappings, getOverlappingLogs, resolveClientFromMapping]);

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
      updated[index] = {
        ...updated[index],
        resolution,
        assignedClientId,
        autoResolvedByMapping: false,
      };
      return updated;
    });

    if (preview) {
      const targetClient = unmatchedClients[index];
      if (!targetClient) return;

      const keysToUpdate: string[] = [];
      preview.unmatched.forEach((invoice, invoiceIndex) => {
        if (rutMatches(targetClient.rut, invoice.rut)) {
          keysToUpdate.push(`unmatched-${invoice.folio}-${invoiceIndex}`);
        }
      });

      setSelectedInvoices((prevSelected) => {
        const nextSelected = new Set(prevSelected);
        keysToUpdate.forEach((key) => {
          if (resolution === 'ignore') nextSelected.delete(key);
          else nextSelected.add(key);
        });
        return nextSelected;
      });
    }
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
        const client = unmatchedClients.find((item) => rutMatches(item.rut, inv.rut));
        const isResolvable = client && client.resolution !== 'pending' && client.resolution !== 'ignore';
        if (!isResolvable) {
          next.delete(key);
          return;
        }
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
      const uc = unmatchedClients.find(c => rutMatches(c.rut, inv.rut));
      return !!uc && uc.resolution !== 'ignore' && uc.resolution !== 'pending';
    }).length;
  };

  const getSelectedDuplicatesCount = () => {
    if (!preview) return 0;
    return preview.duplicates.filter((inv, i) => selectedInvoices.has(`duplicates-${inv.folio}-${i}`)).length;
  };

  const toggleAllDuplicates = (checked: boolean) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      preview?.duplicates.forEach((inv, i) => {
        const key = `duplicates-${inv.folio}-${i}`;
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const canImport = () => {
    if (!preview) return false;
    return (getSelectedMatchedCount() + getSelectedUnmatchedCount() + getSelectedDuplicatesCount()) > 0;
  };

  const handleImport = async () => {
    if (!preview) return;

    setStep('importing');
    setImporting(true);
    setLastError(null);
    setProgressCurrent(0);
    setProgressTotal(0);
    setProgressStage('Preparando importación...');

    let imported = 0;
    let errors = 0;
    const totalItems = invoicesToInsertCount();
    setProgressTotal(totalItems);

    const updateProgress = (count: number) => {
      setProgressCurrent((prev) => prev + count);
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      if (!userId) {
        throw new Error('No se pudo obtener el usuario actual. Inicie sesión nuevamente.');
      }

      // Step 1: Create clients that need to be created
      setProgressStage('Resolviendo clientes...');
      const clientRutToId = new Map<string, string>();
      const setClientRutToId = (rut: string, id: string) => {
        rutCandidates(rut).forEach((c) => clientRutToId.set(c, id));
      };
      
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
              setClientRutToId(nRut, result.clients[0].id);
            }
          } catch (err) {
            logger.error('Error creating client:', uc.rut, err);
            errors++;
          }
        } else if (uc.resolution === 'assign' && uc.assignedClientId) {
          setClientRutToId(nRut, uc.assignedClientId);
        }
      }

      // Step 2: Build invoices to insert (only selected ones)
      setProgressStage('Preparando documentos...');
      const invoicesToInsert: any[] = [];

      // Add selected matched invoices
      for (let i = 0; i < preview.matched.length; i++) {
        const inv = preview.matched[i];
        const key = `matched-${inv.folio}-${i}`;
        if (!selectedInvoices.has(key)) continue;

        if (!inv.issueDate) {
          logger.error('Factura omitida por fecha inválida:', inv);
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
          product_service_description: normalizeProductServiceDescription(inv.notes),
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
        
        const ucEntry = unmatchedClients.find(uc => rutMatches(uc.rut, inv.rut));
        
        if (ucEntry?.resolution === 'ignore') continue;
        if (!clientId) {
            logger.error('Factura omitida por falta de cliente:', inv);
            errors++;
            continue;
        }
        if (!inv.issueDate) {
          logger.error('Factura omitida por fecha inválida:', inv);
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
          product_service_description: normalizeProductServiceDescription(inv.notes),
          created_by: userId,
        });
      }

      // Add selected duplicate invoices
      if (preview.duplicates) {
        for (let i = 0; i < preview.duplicates.length; i++) {
          const inv = preview.duplicates[i];
          const key = `duplicates-${inv.folio}-${i}`;
          if (!selectedInvoices.has(key)) continue;

          // Try to resolve client if not present (from newly created clients)
          let clientId = inv.clientId;
          if (!clientId) {
            const nRut = normalizeRut(inv.rut);
            clientId = clientRutToId.get(nRut);
            
            // If still not found, check existing clients
             if (!clientId) {
                const existingClient = clients.find(c => rutMatches(c.rut, inv.rut));
                if (existingClient) clientId = existingClient.id;
             }
          }

          if (!clientId) {
             logger.error('Factura duplicada omitida por falta de cliente:', inv);
             errors++;
             continue;
          }

          if (!inv.issueDate) {
             logger.error('Factura duplicada omitida por fecha inválida:', inv);
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
            product_service_description: normalizeProductServiceDescription(inv.notes),
            created_by: userId,
          });
        }
      }

      // Step 3: Insert in batches of 50
      if (invoicesToInsert.length === 0 && errors > 0) {
          toast.error("No se pudieron preparar facturas para importar", {
              description: "Verifique que las fechas y clientes sean válidos."
          });
          setLastError("No se pudieron preparar facturas. Verifique fechas y clientes.");
          await persistImportArtifacts(0, errors, preview, unmatchedClients);
          setImportResult({ imported: 0, errors });
          setStep('done');
          return;
      }

      setProgressTotal(invoicesToInsert.length);
      setProgressCurrent(0);
      setProgressStage(invoicesToInsert.length > 0 ? 'Insertando facturas...' : 'Sin facturas para importar');

      const batchSize = 50;
      for (let i = 0; i < invoicesToInsert.length; i += batchSize) {
        const batch = invoicesToInsert.slice(i, i + batchSize);
        setProgressStage(`Insertando facturas (${Math.min(i + batch.length, invoicesToInsert.length)}/${invoicesToInsert.length})...`);
        const { error } = await supabase.from('invoices').insert(batch);
        
        if (error) {
          const m = (error.message || '').toLowerCase();
          const isMissingProductServiceDescriptionColumn =
            m.includes('product_service_description') && (m.includes('could not find') || m.includes('schema cache'));

          if (isMissingProductServiceDescriptionColumn) {
            const sanitizedBatch = batch.map((row: any) => {
              const { product_service_description: _ignored, ...rest } = row;
              return rest;
            });
            const { error: retryError } = await supabase.from('invoices').insert(sanitizedBatch);
            if (!retryError) {
              imported += sanitizedBatch.length;
              updateProgress(batch.length);
              continue;
            }
          }

          logger.error('Batch insert error:', error);
          errors += batch.length;
          const isDuplicate = error.message?.includes('invoices_folio_key') || error.message?.includes('duplicate key');
          const msg = isDuplicate
            ? `Se encontraron ${batch.length} facturas que ya existen en el sistema. Estas facturas ya fueron importadas anteriormente.`
            : (error.message || 'Error desconocido al insertar facturas');
          setLastError(msg);
          if (!isDuplicate) {
            toast.error(`Error en lote ${Math.floor(i/batchSize) + 1}`, { description: msg });
          }
        } else {
          imported += batch.length;
        }
        updateProgress(batch.length);
      }

      await persistImportArtifacts(imported, errors, preview, unmatchedClients);
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
      logger.error('Import error:', err);
      const msg = err.message || 'Error desconocido durante la importación';
      setLastError(msg);
      toast.error('Error durante la importación', {
        description: msg,
      });
      await persistImportArtifacts(imported, errors || totalItems, preview, unmatchedClients);
      setImportResult({ imported: imported, errors: errors || totalItems });
      setStep('done');
    } finally {
      setImporting(false);
    }
  };

  const invoicesToInsertCount = () => {
      return getSelectedMatchedCount() + getSelectedUnmatchedCount() + getSelectedDuplicatesCount();
  };

  const totalToImport = getSelectedMatchedCount() + getSelectedUnmatchedCount() + getSelectedDuplicatesCount();
  const pendingUnmatchedClients = useMemo(
    () => unmatchedClients.filter((client) => client.resolution === 'pending'),
    [unmatchedClients]
  );
  const allUnmatchedPending = unmatchedClients.length > 0 && pendingUnmatchedClients.length === unmatchedClients.length;

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-clip flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Importar Historial de Facturas
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
              <Card className="border-violet-200/70 bg-violet-50/40">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between text-left">
                      <div>
                        <CardTitle className="text-base text-violet-700">¿Cómo obtener este archivo?</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Descarga el libro desde Facturacion.cl antes de importarlo.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-violet-200 text-violet-700">
                        {instructionsOpen ? 'Ocultar' : 'Mostrar'}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    {[
                      'Ingresa a Facturacion.cl y abre Ventas > Libro de Ventas.',
                      'Selecciona el rango de fechas que quieres importar y haz clic en Buscar.',
                      'Usa Exportar y descarga el archivo en formato Excel (.xlsx) o CSV.',
                    ].map((stepText, index) => (
                      <div key={stepText} className="flex items-start gap-3 rounded-lg border border-violet-200/60 bg-background/90 p-3">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
                          {index + 1}
                        </div>
                        <p className="text-sm text-foreground">{stepText}</p>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-violet-600 bg-violet-600/5' : 'border-muted-foreground/30 hover:border-violet-600/50'}`}
            >
              <input {...getInputProps()} />
              <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">
                {isDragActive ? 'Suelta el archivo aquí...' : 'Arrastra tu archivo CSV o XLSX'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Reporte exportado manualmente desde Facturacion.cl
              </p>
              <Button variant="outline" className="mt-4">
                Seleccionar archivo
              </Button>
            </div>

            <Card>
              <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileSpreadsheet className="size-4 text-violet-600" />
                    Formatos aceptados
                  </div>
                  <p className="text-sm text-muted-foreground">`.csv`, `.xlsx`, `.xls`</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarRange className="size-4 text-violet-600" />
                    Columnas esperadas
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Folio, Fecha, RUT, Razón Social, Neto, IVA, Total, Pagado
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-none px-1 py-4 gap-y-4">
              {overlappingImportLog && (
                <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Posible período ya importado</AlertTitle>
                  <AlertDescription>
                    Ya importaste documentos del período {formatDate(overlappingImportLog.date_range_start)} - {formatDate(overlappingImportLog.date_range_end)} el {formatDate(overlappingImportLog.created_at)} ({overlappingImportLog.file_name}). Es probable que este archivo contenga duplicados. Revisa la pestaña "Duplicados" antes de importar.
                  </AlertDescription>
                </Alert>
              )}

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
                <div>
                  Rango detectado: <span className="font-medium text-foreground">{formatDate(getPreviewDateRange(preview).start)} - {formatDate(getPreviewDateRange(preview).end)}</span>
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
                    {pendingUnmatchedClients.length > 0 && (
                      <span className="absolute top-0 right-0 -mt-1 -mr-1 flex size-3">
                        <span className="animate-ping absolute inline-flex size-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full size-3 bg-amber-500"></span>
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="duplicates">
                    Duplicados ({preview.duplicates.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="h-[45vh] md:h-[50vh] overflow-clip border rounded-md bg-muted/10">
                <TabsContent value="matched" className="h-full mt-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {preview.matched.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <CheckCircle className="size-4 text-green-500" />
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
                              <AlertTriangle className="size-4 text-amber-500" />
                              Clientes no encontrados ({unmatchedClients.length}) — {preview.unmatched.length} facturas
                            </h3>
                          </div>

                          {allUnmatchedPending && (
                            <Button
                              className="mb-4 bg-violet-600 hover:bg-violet-700"
                              onClick={() => handleBulkAction('create')}
                            >
                              Crear todos como nuevos ({unmatchedClients.length})
                            </Button>
                          )}

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
                                    <UserPlus className="size-3.5 mr-1" />
                                    Crear
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 text-xs flex-1 sm:flex-none"
                                    onClick={handleBulkAssign}
                                    disabled={selectedUnmatchedClientIndices.size === 0}
                                >
                                    <Users className="size-3.5 mr-1" />
                                    Asignar
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 text-xs flex-1 sm:flex-none"
                                    onClick={() => handleBulkAction('ignore')}
                                    disabled={selectedUnmatchedClientIndices.size === 0}
                                >
                                    <Ban className="size-3.5 mr-1" />
                                    Ignorar
                                </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-3 mb-6">
                            {unmatchedClients.map((uc, index) => (
                              <div
                                key={uc.rut}
                                className={`border rounded-lg p-3 bg-card transition-colors ${
                                  selectedUnmatchedClientIndices.has(index) ? 'border-primary/50 bg-primary/5' : ''
                                } ${
                                  uc.suggestion && uc.suggestion.score > 0.75 && uc.assignedClientId === uc.suggestion.clientId
                                    ? 'border-violet-200 bg-violet-50/40'
                                    : ''
                                }`}
                              >
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
                                                {uc.autoResolvedByMapping && (
                                                  <TooltipProvider>
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 p-1 text-violet-600">
                                                          <RotateCw className="size-3" />
                                                        </span>
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        Resuelto automaticamente por importacion anterior
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </TooltipProvider>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="size-6 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openQuickEdit(index)}
                                                    title="Editar datos del cliente"
                                                >
                                                    <Edit2 className="size-3.5" />
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

                                  {uc.suggestion && uc.suggestion.score > 0.75 && uc.assignedClientId === uc.suggestion.clientId && (
                                    <div className="ml-8 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                                      <span className="inline-flex items-center gap-2">
                                        <Sparkles className="size-3.5" />
                                        Sugerencia preseleccionada: <strong>{uc.suggestion.name}</strong> ({(uc.suggestion.score * 100).toFixed(0)}%)
                                      </span>
                                    </div>
                                  )}

                                  {uc.suggestion && uc.suggestion.score <= 0.75 && uc.resolution === 'pending' && (
                                    <div className="ml-8 p-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 rounded flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-400">
                                        <Sparkles className="size-3.5" />
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
                                      <UserPlus className="size-3" />
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
                                        <Users className="size-3" />
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
                                      <Ban className="size-3" />
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
                                    checked={
                                      getSelectedUnmatchedCount() === preview.unmatched.filter((invoice) => {
                                        const client = unmatchedClients.find((item) => rutMatches(item.rut, invoice.rut));
                                        return client && client.resolution !== 'pending' && client.resolution !== 'ignore';
                                      }).length && preview.unmatched.length > 0
                                    }
                                    onCheckedChange={(checked) => toggleAllUnmatched(!!checked)}
                                  />
                                  Seleccionar disponibles
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
                              <XCircle className="size-4 text-muted-foreground" />
                              Duplicados detectados ({getSelectedDuplicatesCount()}/{preview.duplicates.length})
                            </h3>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={getSelectedDuplicatesCount() === preview.duplicates.length && preview.duplicates.length > 0}
                                onCheckedChange={(checked) => toggleAllDuplicates(!!checked)}
                              />
                              Seleccionar todas
                            </label>
                          </div>
                          <InvoicePreviewTable 
                            invoices={preview.duplicates} 
                            selectedKeys={selectedInvoices}
                            keyPrefix="duplicates"
                            onToggle={toggleInvoice}
                          />
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
                {!canImport() && <AlertTriangle className="size-4" />}
                Importar {totalToImport} documento{totalToImport !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium text-foreground">Importando facturas...</p>
            <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos</p>
            <div className="w-full max-w-md mt-6 space-y-2 px-4">
              <Progress
                value={
                  progressTotal > 0
                    ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100))
                    : 0
                }
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progressStage || 'Procesando...'}</span>
                <span>
                  {progressTotal > 0 ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100)) : 0}% ({Math.min(progressCurrent, progressTotal)}/{progressTotal})
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            {importResult.errors > 0 && importResult.imported === 0 ? (
              lastError?.includes('ya existen') || lastError?.includes('ya fueron importadas') ? (
                <>
                  <div className="size-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                    <Ban className="size-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-lg font-medium text-foreground">
                    Facturas ya importadas
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    Las {importResult.errors} facturas seleccionadas ya se encuentran registradas en el sistema. No se crearon duplicados.
                  </p>
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm rounded-md max-w-md">
                    💡 Si necesita re-importar, elimine primero las facturas existentes desde el historial de ventas.
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-12 text-destructive mb-4" />
                  <p className="text-lg font-medium text-foreground">Error en la importación</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {importResult.imported} facturas importadas, {importResult.errors} con errores
                  </p>
                  {lastError && (
                    <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md max-w-md break-words">
                      {lastError}
                    </div>
                  )}
                </>
              )
            ) : (
              <>
                <CheckCircle className="size-12 text-green-500 mb-4" />
                <p className="text-lg font-medium text-foreground">Importación completada</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {importResult.imported} facturas importadas exitosamente
                  {importResult.errors > 0 && `, ${importResult.errors} con errores`}
                </p>
                {lastError && (
                  <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md max-w-md break-words">
                    {lastError}
                  </div>
                )}
              </>
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
      <DialogContent className="w-[min(95vw,28rem)]">
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
      <DialogContent className="w-[min(95vw,28rem)]">
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
