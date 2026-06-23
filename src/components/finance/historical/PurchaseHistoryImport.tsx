import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, UserPlus, Users, Ban, Edit2, Sparkles, RotateCw, Check, FileSpreadsheet, CalendarRange } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useSuppliers } from '@/hooks/useSuppliers';
import { formatRut } from '@/utils/rutFormatter';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { stringSimilarity, toTitleCase } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useImportMappings, type ImportMappingResolution } from '@/hooks/useImportMappings';
import { useImportHistoryLog, type ImportHistoryLogEntry } from '@/hooks/useImportHistoryLog';
import { useHistoricalImport } from '@/hooks/useHistoricalImport';
import {
  parseCSVFile,
  parseXLSXFile,
  processPurchaseRows,
  PurchaseImportPreview,
  UnmatchedSupplier,
  PurchaseImportStatus,
  getPurchaseImportKey,
  getEffectivePurchaseStatus,
  getPurchaseImportDescription,
} from '@/utils/purchaseHistoryParser';
import { createLogger } from "@/lib/logger";
import { formatCLP, formatDate, normalizeRut, rutCandidates, rutMatches, getInvoiceStatusBadgeClass } from '@/utils/purchase/purchaseImportHelpers';
import { applyStatusToSelectedKeys, getImportSelectionState, toggleAllImportableKeys } from '@/utils/historicalImportSelection';


const logger = createLogger("PurchaseHistoryImport");
interface PurchaseHistoryImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

type ResolvedUnmatchedSupplier = UnmatchedSupplier & {
  autoResolvedByMapping?: boolean;
  mappingSourceResolution?: ImportMappingResolution;
};

const sortUnmatchedSuppliers = (items: ResolvedUnmatchedSupplier[]) =>
  [...items].sort((a, b) => b.invoiceCount - a.invoiceCount || a.razonSocial.localeCompare(b.razonSocial, 'es'));

const normalizeImportFileName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/ \(\d+\)(?=\.[^.]+$)/, '');

const getPreviewDateRange = (preview: PurchaseImportPreview | null) => {
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

const PurchaseHistoryImport: React.FC<PurchaseHistoryImportProps> = ({ open, onOpenChange, onImportComplete }) => {
  const { suppliers } = useSuppliers();
  const queryClient = useQueryClient();
  const { getMappings, saveMapping } = useImportMappings('purchase');
  const { logs: importLogs, getOverlappingLogs, saveLog } = useImportHistoryLog('purchase', 5);
  const { getCurrentUserId, insertInvoiceBatch, insertSupplier, loadExistingDedupData } = useHistoricalImport();
  const [step, setStep] = useState<Step>('upload');
  const [activeTab, setActiveTab] = useState('matched');
  const [preview, setPreview] = useState<PurchaseImportPreview | null>(null);
  const [unmatchedSuppliers, setUnmatchedSuppliers] = useState<ResolvedUnmatchedSupplier[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [statusOverrides, setStatusOverrides] = useState<Map<string, PurchaseImportStatus>>(new Map());
  const [bulkStatus, setBulkStatus] = useState<PurchaseImportStatus | ''>('');
  const [selectedUnmatchedSupplierIndices, setSelectedUnmatchedSupplierIndices] = useState<Set<number>>(new Set());
  const [editingSupplierIndex, setEditingSupplierIndex] = useState<number | null>(null);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkAssignSupplierId, setBulkAssignSupplierId] = useState<string>('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [editSupplierForm, setEditSupplierForm] = useState<{
    name: string;
    rut: string;
    category: string;
  }>({ name: '', rut: '', category: 'General' });

  // Create Supplier State
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState<{
    rut: string;
    name: string;
    category: string;
    contactName: string;
    email: string;
    phone: string;
  }>({
    rut: '',
    name: '',
    category: 'General',
    contactName: '',
    email: '',
    phone: ''
  });
  const [overlappingImportLog, setOverlappingImportLog] = useState<ImportHistoryLogEntry | null>(null);

  // Compute suggestions when unmatched suppliers are set
  useEffect(() => {
    if (unmatchedSuppliers.length > 0 && suppliers.length > 0) {
      // Only compute if not already computed (optimization)
      const needsComputation = unmatchedSuppliers.some(us => !us.suggestion && us.resolution === 'pending');
      
      if (needsComputation) {
        setUnmatchedSuppliers(prev => {
          return prev.map(us => {
            if (us.suggestion || us.resolution !== 'pending') return us;
            
            // Find best match
            let bestMatch = { supplierId: '', name: '', score: 0 };
            
            for (const supplier of suppliers) {
              const score = stringSimilarity(us.razonSocial.toLowerCase(), supplier.name.toLowerCase());
              if (score > bestMatch.score) {
                bestMatch = { supplierId: supplier.id, name: supplier.name, score };
              }
            }
            
            // Auto-preselect strong suggestions to reduce clicks.
            if (bestMatch.score > 0.6) {
              if (bestMatch.score > 0.75) {
                return {
                  ...us,
                  suggestion: bestMatch,
                  resolution: 'assign',
                  assignedSupplierId: bestMatch.supplierId,
                };
              }

              return { ...us, suggestion: bestMatch };
            }
            
            return us;
          });
        });
      }
    }
  }, [unmatchedSuppliers.length, suppliers.length]);

  // Initialize selection when preview changes
  useEffect(() => {
    if (preview) {
      const allKeys = new Set<string>();
      preview.matched.forEach((inv) => allKeys.add(getPurchaseImportKey(inv)));
      preview.unmatched.forEach((inv) => allKeys.add(getPurchaseImportKey(inv)));
      preview.duplicates.forEach((inv) => allKeys.add(getPurchaseImportKey(inv)));
      setSelectedInvoices(allKeys);
      setStatusOverrides(new Map());
      setBulkStatus('');
    }
  }, [preview]);

  useEffect(() => {
    if (activeTab !== 'unmatched') return;
    if (unmatchedSuppliers.length === 0 || unmatchedSuppliers.length >= 10) return;
    if (selectedUnmatchedSupplierIndices.size > 0) return;

    const allIndices = new Set<number>();
    unmatchedSuppliers.forEach((_, index) => allIndices.add(index));
    setSelectedUnmatchedSupplierIndices(allIndices);
  }, [activeTab, unmatchedSuppliers, selectedUnmatchedSupplierIndices.size]);

  const persistImportArtifacts = useCallback(
    async (imported: number, errors: number, currentPreview: PurchaseImportPreview, resolvedSuppliers: ResolvedUnmatchedSupplier[]) => {
      const dateRange = getPreviewDateRange(currentPreview);
      const skippedCount = Math.max(0, currentPreview.totalInvoices - imported - errors);
      const status =
        imported === 0 ? 'failed' : errors === 0 ? 'success' : 'partial';

      try {
        await saveLog({
          importType: 'purchase',
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
          resolvedSuppliers
            .filter((supplier) => supplier.resolution !== 'pending')
            .map(async (supplier) => {
              const assignedSupplier = supplier.assignedSupplierId
                ? suppliers.find((existingSupplier) => existingSupplier.id === supplier.assignedSupplierId)
                : null;

              await saveMapping(
                'purchase',
                supplier.rut,
                supplier.razonSocial,
                supplier.resolution as ImportMappingResolution,
                supplier.resolution === 'assign' ? supplier.assignedSupplierId ?? null : null,
                supplier.resolution === 'assign'
                  ? assignedSupplier?.name ?? supplier.suggestion?.name ?? null
                  : supplier.resolution === 'create'
                    ? supplier.razonSocial
                    : null
              );
            })
        );
      } catch (mappingError) {
        logger.error('Error saving import mappings:', mappingError);
      }
    },
    [fileName, saveLog, saveMapping, suppliers]
  );

  const resolveSupplierFromMapping = useCallback(
    (
      supplier: UnmatchedSupplier,
      mapping: Awaited<ReturnType<typeof getMappings>>[number] | undefined
    ): ResolvedUnmatchedSupplier => {
      if (!mapping) return supplier;

      if (mapping.resolution === 'ignore') {
        return {
          ...supplier,
          resolution: 'ignore',
          autoResolvedByMapping: true,
          mappingSourceResolution: mapping.resolution,
        };
      }

      if (mapping.resolution === 'assign' && mapping.mapped_entity_id) {
        return {
          ...supplier,
          resolution: 'assign',
          assignedSupplierId: mapping.mapped_entity_id,
          autoResolvedByMapping: true,
          mappingSourceResolution: mapping.resolution,
        };
      }

      const existingSupplier = suppliers.find((currentSupplier) => rutMatches(currentSupplier.rut || '', supplier.rut));
      if (existingSupplier) {
        return {
          ...supplier,
          resolution: 'assign',
          assignedSupplierId: existingSupplier.id,
          autoResolvedByMapping: true,
          mappingSourceResolution: mapping.resolution,
        };
      }

      return {
        ...supplier,
        resolution: 'create',
        autoResolvedByMapping: true,
        mappingSourceResolution: mapping.resolution,
      };
    },
    [getMappings, suppliers]
  );

  const toggleUnmatchedSupplierSelection = (index: number) => {
    setSelectedUnmatchedSupplierIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllUnmatchedSuppliers = (checked: boolean) => {
    if (checked) {
      const allIndices = new Set<number>();
      unmatchedSuppliers.forEach((_, i) => allIndices.add(i));
      setSelectedUnmatchedSupplierIndices(allIndices);
    } else {
      setSelectedUnmatchedSupplierIndices(new Set());
    }
  };

  const handleBulkAction = (action: 'create' | 'assign' | 'ignore', assignedSupplierId?: string) => {
    if (selectedUnmatchedSupplierIndices.size === 0) {
      toast.error("Seleccione al menos un proveedor");
      return;
    }

    setUnmatchedSuppliers(prev => {
      const nextSuppliers = prev.map((us, i) => {
        if (selectedUnmatchedSupplierIndices.has(i)) {
          return { ...us, resolution: action, assignedSupplierId, autoResolvedByMapping: false };
        }
        return us;
      });
      return nextSuppliers;
    });
    
    // Auto-select invoices for resolved suppliers
    if (preview && action !== 'ignore') {
       const indicesToSelect: string[] = [];
       preview.unmatched.forEach((inv, i) => {
           const nRut = normalizeRut(inv.rut);
           // Find if this invoice belongs to one of the resolved suppliers
           const supplierIndex = unmatchedSuppliers.findIndex(s => rutMatches(s.rut, nRut));
           if (selectedUnmatchedSupplierIndices.has(supplierIndex)) {
               indicesToSelect.push(getPurchaseImportKey(inv));
           }
       });
       
       setSelectedInvoices(prev => {
           const next = new Set(prev);
           indicesToSelect.forEach(idx => next.add(idx));
           return next;
       });
    } else if (action === 'ignore') {
       // Deselect ignored invoices
       const indicesToDeselect: string[] = [];
       preview?.unmatched.forEach((inv, i) => {
           const nRut = normalizeRut(inv.rut);
           const supplierIndex = unmatchedSuppliers.findIndex(s => rutMatches(s.rut, nRut));
           if (selectedUnmatchedSupplierIndices.has(supplierIndex)) {
               indicesToDeselect.push(`unmatched-${inv.invoice_number}-${i}`);
           }
       });
       
       setSelectedInvoices(prev => {
           const next = new Set(prev);
           indicesToDeselect.forEach(idx => next.delete(idx));
           return next;
       });
    }

    // Clear selection after action
    setSelectedUnmatchedSupplierIndices(new Set());
    toast.success(`Acción aplicada a ${selectedUnmatchedSupplierIndices.size} proveedores`);
  };

  const handleBulkAssign = () => {
    if (selectedUnmatchedSupplierIndices.size === 0) {
      toast.error("Seleccione al menos un proveedor");
      return;
    }
    setBulkAssignDialogOpen(true);
  };

  const confirmBulkAssign = () => {
    if (!bulkAssignSupplierId) {
      toast.error("Seleccione un proveedor para asignar");
      return;
    }
    handleBulkAction('assign', bulkAssignSupplierId);
    setBulkAssignDialogOpen(false);
    setBulkAssignSupplierId('');
  };

  const applySuggestion = (index: number) => {
    const supplier = unmatchedSuppliers[index];
    if (!supplier?.suggestion) return;

    handleSupplierResolution(index, 'assign', supplier.suggestion.supplierId);
    toast.success('Sugerencia aplicada');
  };

  const handleSupplierResolution = (index: number, resolution: 'create' | 'assign' | 'ignore', assignedSupplierId?: string) => {
    setUnmatchedSuppliers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], resolution, assignedSupplierId, autoResolvedByMapping: false };
      return updated;
    });

    // Update invoice selection based on resolution
    if (preview) {
        const us = unmatchedSuppliers[index];
        const nRut = normalizeRut(us.rut);
        const indicesToUpdate: string[] = [];
        
        preview.unmatched.forEach((inv, i) => {
            if (normalizeRut(inv.rut) === nRut) {
                indicesToUpdate.push(`unmatched-${inv.invoice_number}-${i}`);
            }
        });

        setSelectedInvoices(prev => {
            const next = new Set(prev);
            indicesToUpdate.forEach(idx => {
                if (resolution === 'ignore') next.delete(idx);
                else next.add(idx);
            });
            return next;
        });
    }
  };

  const openQuickEdit = (index: number) => {
    const us = unmatchedSuppliers[index];
    setEditingSupplierIndex(index);
    setEditSupplierForm({
      name: us.razonSocial,
      rut: us.rut,
      category: 'General',
    });
  };

  const saveQuickEdit = () => {
    if (editingSupplierIndex === null) return;
    
    setUnmatchedSuppliers(prev => {
      const updated = [...prev];
      updated[editingSupplierIndex] = {
        ...updated[editingSupplierIndex],
        razonSocial: editSupplierForm.name,
        resolution: 'create',
        autoResolvedByMapping: false,
      };
      return updated;
    });
    
    // Auto select invoices
    if (preview) {
        const us = unmatchedSuppliers[editingSupplierIndex];
        const nRut = normalizeRut(us.rut);
        const indicesToSelect: string[] = [];
        preview.unmatched.forEach((inv, i) => {
            if (normalizeRut(inv.rut) === nRut) {
                indicesToSelect.push(getPurchaseImportKey(inv));
            }
        });
        setSelectedInvoices(prev => {
            const next = new Set(prev);
            indicesToSelect.forEach(idx => next.add(idx));
            return next;
        });
    }

    setEditingSupplierIndex(null);
    toast.success('Proveedor actualizado');
  };

  const resetState = () => {
    setStep('upload');
    setPreview(null);
    setUnmatchedSuppliers([]);
    setImportResult(null);
    setLastError(null);
    setFileName('');
    setSelectedInvoices(new Set());
    setStatusOverrides(new Map());
    setBulkStatus('');
    setActiveTab('matched');
    setIsCreatingSupplier(false);
    setSelectedUnmatchedSupplierIndices(new Set());
    setEditingSupplierIndex(null);
    setProgressCurrent(0);
    setProgressTotal(0);
    setProgressStage('');
    setOverlappingImportLog(null);
  };

  useEffect(() => {
    if (!open) return;
    resetState();
  }, [open]);

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    setSelectedInvoices(new Set());
    setStatusOverrides(new Map());
    setBulkStatus('');
    setLastError(null);
    setImportResult(null);
    setOverlappingImportLog(null);

    try {
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      const rows = isCSV ? await parseCSVFile(file) : await parseXLSXFile(file);

      if (rows.length === 0) {
        toast.error('Archivo vacío', { description: 'No se encontraron datos en el archivo.' });
        return;
      }

      // Fetch existing invoices and inventory_suppliers separately (no FK join available)
      const PAGE_SIZE = 1000;
      const existingInvoices: any[] = [];
      let invFrom = 0;
      while (true) {
        const { data: chunk, error } = await supabase
          .from('supplier_invoices')
          .select('invoice_number, supplier_id')
          .not('invoice_number', 'is', null)
          .range(invFrom, invFrom + PAGE_SIZE - 1);
        if (error) throw error;
        if (!chunk || chunk.length === 0) break;
        existingInvoices.push(...chunk);
        if (chunk.length < PAGE_SIZE) break;
        invFrom += PAGE_SIZE;
      }

      const allInvSups: any[] = [];
      let supFrom = 0;
      while (true) {
        const { data: chunk, error } = await supabase
          .from('inventory_suppliers')
          .select('id, rut')
          .range(supFrom, supFrom + PAGE_SIZE - 1);
        if (error) throw error;
        if (!chunk || chunk.length === 0) break;
        allInvSups.push(...chunk);
        if (chunk.length < PAGE_SIZE) break;
        supFrom += PAGE_SIZE;
      }

      const supplierIdToRut = new Map<string, string>();
      allInvSups.forEach((s: any) => {
        if (s.rut) supplierIdToRut.set(s.id, normalizeRut(s.rut));
      });

      const existingKeys = new Set<string>();
      existingInvoices.forEach((inv: any) => {
        const nRut = supplierIdToRut.get(inv.supplier_id);
        if (nRut && inv.invoice_number) {
          existingKeys.add(`${nRut}-${inv.invoice_number}`);
        }
      });

      const result = processPurchaseRows(rows, suppliers, existingKeys);
      const savedMappings = await getMappings('purchase');
      const mappingByRut = new Map(
        savedMappings.map((mapping) => [normalizeRut(mapping.source_rut), mapping])
      );
      const resolvedUnmatchedSuppliers = sortUnmatchedSuppliers(
        result.unmatchedSuppliers.map((supplier) =>
          resolveSupplierFromMapping(supplier, mappingByRut.get(normalizeRut(supplier.rut)))
        )
      );
      const previewDateRange = getPreviewDateRange(result);
      const overlappingLogs =
        previewDateRange.start && previewDateRange.end
          ? await getOverlappingLogs('purchase', previewDateRange.start, previewDateRange.end)
          : [];

      const normalizedCurrentFileName = normalizeImportFileName(file.name);
      const sameFileOverlappingLog =
        overlappingLogs.find((log) => normalizeImportFileName(log.file_name) === normalizedCurrentFileName) ?? null;

      setPreview(result);
      setUnmatchedSuppliers(resolvedUnmatchedSuppliers);
      setOverlappingImportLog(result.duplicates.length > 0 ? sameFileOverlappingLog : null);
      setStep('preview');
      
      if (resolvedUnmatchedSuppliers.some((supplier) => supplier.resolution === 'pending')) {
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
      toast.error('Error al leer el archivo', { description: 'Verifica el formato.' });
    }
  }, [getMappings, getOverlappingLogs, resolveSupplierFromMapping, suppliers]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

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
        const key = getPurchaseImportKey(inv);
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
        const nRut = normalizeRut(inv.rut);
        const uc = unmatchedSuppliers.find(c => rutMatches(c.rut, nRut));
        
        // Only select if resolved (created or assigned)
        if (uc && (uc.resolution === 'create' || uc.resolution === 'assign')) {
           const key = getPurchaseImportKey(inv);
           if (checked) next.add(key);
           else next.delete(key);
        }
      });
      return next;
    });
  };
  
  const toggleAllDuplicates = (checked: boolean) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      preview?.duplicates.forEach((inv, i) => {
        const key = getPurchaseImportKey(inv);
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const getSelectedMatchedCount = () => {
    if (!preview) return 0;
    return preview.matched.filter((inv) => selectedInvoices.has(getPurchaseImportKey(inv))).length;
  };

  const getSelectedUnmatchedCount = () => {
    if (!preview) return 0;
    return preview.unmatched.filter((inv, i) => {
      const key = getPurchaseImportKey(inv);
      if (!selectedInvoices.has(key)) return false;
      const nRut = normalizeRut(inv.rut);
      const us = unmatchedSuppliers.find(s => rutMatches(s.rut, nRut));
      return !!us && (us.resolution === 'create' || us.resolution === 'assign');
    }).length;
  };

  const getSelectedDuplicatesCount = () => {
    if (!preview) return 0;
    return preview.duplicates.filter((inv) => selectedInvoices.has(getPurchaseImportKey(inv))).length;
  };

  const canImport = () => {
    if (!preview) return false;
    return (getSelectedMatchedCount() + getSelectedUnmatchedCount() + getSelectedDuplicatesCount()) > 0;
  };

  const importableInvoices = useMemo(() => {
    if (!preview) return [];
    const resolvedUnmatched = preview.unmatched.filter((invoice) => {
      const supplier = unmatchedSuppliers.find((item) => rutMatches(item.rut, invoice.rut));
      return supplier && (supplier.resolution === 'create' || supplier.resolution === 'assign');
    });
    return [...preview.matched, ...resolvedUnmatched, ...preview.duplicates];
  }, [preview, unmatchedSuppliers]);

  const importableKeys = useMemo(
    () => importableInvoices.map(getPurchaseImportKey),
    [importableInvoices],
  );
  const { selectedCount: selectedImportableCount, allSelected: allImportableSelected, indeterminate: someImportableSelected } =
    getImportSelectionState(importableKeys, selectedInvoices);

  const toggleAllImportable = (checked: boolean) => {
    setSelectedInvoices((previous) => toggleAllImportableKeys(previous, importableKeys, checked));
  };

  const applyBulkStatus = () => {
    if (!bulkStatus || selectedImportableCount === 0) return;
    setStatusOverrides((previous) => applyStatusToSelectedKeys(previous, importableKeys, selectedInvoices, bulkStatus));
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierData.rut || !newSupplierData.name) {
      toast.error('RUT y Nombre son obligatorios');
      return;
    }
    
    // Optimistic update for UI
    const nRut = normalizeRut(newSupplierData.rut);
    
    setUnmatchedSuppliers(prev => prev.map(us => {
      if (rutMatches(us.rut, nRut)) {
        return { 
          ...us, 
          resolution: 'create',
          razonSocial: newSupplierData.name // Update with user provided name
        };
      }
      return us;
    }));
    
    // Auto-select invoices for this supplier
    if (preview) {
        const indicesToSelect: string[] = [];
        preview.unmatched.forEach((inv, i) => {
            if (rutMatches(inv.rut, nRut)) {
                indicesToSelect.push(getPurchaseImportKey(inv));
            }
        });
        
        setSelectedInvoices(prev => {
            const next = new Set(prev);
            indicesToSelect.forEach(idx => next.add(idx));
            return next;
        });
    }

    toast.success('Proveedor configurado para creación', {
      description: 'Se creará al importar las facturas.'
    });
    setIsCreatingSupplier(false);
  };

  const handleImport = async () => {
    if (!preview) return;

    setStep('importing');
    setLastError(null);
    setProgressCurrent(0);
    setProgressTotal(0);
    const importDateRange = getPreviewDateRange(preview);
    const importDateLabel =
      importDateRange.start && importDateRange.end
        ? `${formatDate(importDateRange.start)} - ${formatDate(importDateRange.end)}`
        : '';
    setProgressStage(importDateLabel ? `Preparando importación (${importDateLabel})...` : 'Preparando importación...');

    let imported = 0;
    let errors = 0;
    const userId = await getCurrentUserId();
    
    // 1. Prepare supplier mapping (RUT -> ID) for creation or assignment
    // Map includes newly created suppliers AND assigned existing suppliers
    const supplierRutToId = new Map<string, string>();
    const setSupplierRutToId = (rut: string, id: string) => {
        rutCandidates(rut).forEach((c) => supplierRutToId.set(c, id));
    };

    setProgressStage('Resolviendo proveedores...');
    // Process all unmatched suppliers with resolution
    for (const us of unmatchedSuppliers) {
        const nRut = normalizeRut(us.rut);
        
        if (us.resolution === 'create') {
            try {
                // STRATEGY: 
                // The database enforces foreign key to 'inventory_suppliers'.
                // The UI uses 'suppliers'.
                // We must ensure the supplier exists in 'inventory_suppliers' to satisfy the constraint.
                // We also try to create in 'suppliers' to keep UI in sync.

                // A. Handle inventory_suppliers (CRITICAL for FK constraint)
                let inventorySupplierId: string | null = null;
                
                const { data: allInvSups } = await supabase
                    .from('inventory_suppliers')
                    .select('id, rut');
                
                const existingInvSup = allInvSups?.find((s: any) => rutMatches(s.rut || '', nRut));

                if (existingInvSup) {
                    inventorySupplierId = existingInvSup.id;
                } else {
                    // Create in inventory_suppliers
                    const { data: newInvSup, error: invSupError } = await supabase
                        .from('inventory_suppliers')
                        .insert({
                            name: us.razonSocial,
                            rut: us.rut,
                            is_active: true
                        })
                        .select('id')
                        .single();
                    
                    if (invSupError) {
                        logger.error('Error creating inventory_supplier:', invSupError);
                        // If this fails, we can't insert invoices for this supplier due to FK
                        errors++; 
                        continue;
                    }
                    inventorySupplierId = newInvSup.id;
                }

                // B. Handle public.suppliers (For UI consistency)
                // We do this 'best effort' - if it fails, we don't block the import
                try {
                    // Check by fetching all and normalizing (RUT format may differ)
                    const { data: allSups } = await supabase
                        .from('suppliers')
                        .select('id, rut');
                    
                    const existingSup = allSups?.find(s => rutMatches(s.rut || '', nRut));
                    
                    if (!existingSup) {
                        await insertSupplier(us.razonSocial, us.rut, userId);
                    }
                } catch (e) {
                    logger.warn('Error syncing to suppliers table:', e);
                }

                // Map the RUT to the INVENTORY_SUPPLIER ID because that's what the invoice table references
                if (inventorySupplierId) {
                    setSupplierRutToId(nRut, inventorySupplierId);
                }

            } catch (err) {
                logger.error(`Error processing supplier ${us.rut}:`, err);
                errors++;
            }
        } else if (us.resolution === 'assign' && us.assignedSupplierId) {
            // If assigned, we assume the user selected a supplier from the list (which comes from 'suppliers' table).
            // BUT, we need the ID from 'inventory_suppliers' if the FK points there.
            
            const nRut = normalizeRut(us.rut); // The RUT from the file
            
            // Try to find in inventory_suppliers by normalized RUT
            const { data: allInvSups } = await supabase
                .from('inventory_suppliers')
                .select('id, rut');
            
            const existingInvSup = allInvSups?.find((s: any) => rutMatches(s.rut || '', nRut));
            
            if (existingInvSup) {
                setSupplierRutToId(nRut, existingInvSup.id);
            } else {
                // If not found in inventory_suppliers, we must create it there too!
                try {
                    const { data: newInvSup, error: invSupError } = await supabase
                        .from('inventory_suppliers')
                        .insert({
                            name: us.razonSocial,
                            rut: us.rut,
                            is_active: true
                        })
                        .select('id')
                        .single();
                        
                    if (!invSupError && newInvSup) {
                        setSupplierRutToId(nRut, newInvSup.id);
                    } else {
                        logger.error('Failed to create missing inventory_supplier for assigned supplier:', invSupError);
                        // Fallback: try using the assigned ID directly
                        setSupplierRutToId(nRut, us.assignedSupplierId);
                    }
                } catch (e) {
                    setSupplierRutToId(nRut, us.assignedSupplierId);
                }
            }
        }
    }

    // 2. Resolve inventory_suppliers IDs for MATCHED invoices
    // The suppliers table IDs don't match - FK points to inventory_suppliers
    const matchedRuts = new Set<string>();
    preview.matched.forEach(inv => {
        if (inv.rut) matchedRuts.add(normalizeRut(inv.rut));
    });
    preview.duplicates.forEach(inv => {
        if (inv.rut && inv.supplierId) matchedRuts.add(normalizeRut(inv.rut));
    });

    for (const rut of matchedRuts) {
        if (supplierRutToId.has(rut)) continue; // Already resolved from unmatched step
        
        try {
            // Fetch ALL inventory_suppliers and match by normalized RUT
            // (DB may store formatted RUTs like "77.225.200-5")
            const { data: allInvSups } = await supabase
                .from('inventory_suppliers')
                .select('id, rut, name');
            
            const matchedInvSup = allInvSups?.find((s: any) => rutMatches(s.rut || '', rut));
            
            if (matchedInvSup) {
                setSupplierRutToId(rut, matchedInvSup.id);
            } else {
                // Find supplier info from matched invoices
                const matchedInv = preview.matched.find(inv => rutMatches(inv.rut, rut));
                const supplierName = matchedInv?.razonSocial || 'Proveedor Desconocido';
                const originalRut = matchedInv?.rut || rut;
                
                const { data: newInvSup, error: invSupError } = await supabase
                    .from('inventory_suppliers')
                    .insert({
                        name: supplierName,
                        rut: originalRut,
                        is_active: true
                    })
                    .select('id')
                    .single();
                    
                if (!invSupError && newInvSup) {
                    setSupplierRutToId(rut, newInvSup.id);
                } else {
                    logger.error('Failed to create inventory_supplier for matched RUT:', rut, invSupError);
                }
            }
        } catch (e) {
            logger.error('Error resolving inventory_supplier for matched RUT:', rut, e);
        }
    }

    // 3. Prepare invoices to insert
    setProgressStage('Preparando documentos...');
    const invoicesToInsert: any[] = [];
    // Matched invoices
    preview.matched.forEach((inv, i) => {
        const key = getPurchaseImportKey(inv);
        if (selectedInvoices.has(key) && inv.supplierId) {
            const nRut = normalizeRut(inv.rut);
            const resolvedSupplierId = supplierRutToId.get(nRut) || inv.supplierId;
            const psd = getPurchaseImportDescription(inv);
            invoicesToInsert.push({
                invoice_number: inv.invoice_number,
                supplier_id: resolvedSupplierId,
                issue_date: inv.issueDate,
                due_date: inv.dueDate,
                amount: inv.amount,
                tax_amount: inv.tax_amount,
                net_amount: inv.net_amount,
                description: psd,
                product_service_description: psd,
                source: 'historico',
                status: getEffectivePurchaseStatus(inv, statusOverrides),
            });
        }
    });

    // Unmatched invoices (now resolved)
    preview.unmatched.forEach((inv, i) => {
        const key = getPurchaseImportKey(inv);
        if (selectedInvoices.has(key)) {
            const nRut = normalizeRut(inv.rut);
            
            // Check if this supplier was ignored
            const us = unmatchedSuppliers.find(s => normalizeRut(s.rut) === nRut);
            if (us?.resolution === 'ignore') return;

            // Try to find resolved ID
            const supplierId = supplierRutToId.get(nRut);
            
            if (supplierId) {
                const psd = getPurchaseImportDescription(inv);
                invoicesToInsert.push({
                    invoice_number: inv.invoice_number,
                    supplier_id: supplierId,
                    issue_date: inv.issueDate,
                    due_date: inv.dueDate,
                    amount: inv.amount,
                    tax_amount: inv.tax_amount,
                    net_amount: inv.net_amount,
                    description: psd,
                    product_service_description: psd,
                    source: 'historico',
                    status: getEffectivePurchaseStatus(inv, statusOverrides),
                });
            } else {
                logger.warn(`Skipping invoice ${inv.invoice_number}: Supplier not resolved for RUT ${inv.rut}`);
                errors++;
            }
        }
    });
    
    // Duplicate invoices
    preview.duplicates.forEach((inv, i) => {
        const key = getPurchaseImportKey(inv);
        if (selectedInvoices.has(key)) {
             const nRut = normalizeRut(inv.rut);
             const supplierId = supplierRutToId.get(nRut) || inv.supplierId;

             if (supplierId) {
                const psd = getPurchaseImportDescription(inv);
                invoicesToInsert.push({
                    invoice_number: inv.invoice_number,
                    supplier_id: supplierId,
                    issue_date: inv.issueDate,
                    due_date: inv.dueDate,
                    amount: inv.amount,
                    tax_amount: inv.tax_amount,
                    net_amount: inv.net_amount,
                    description: psd,
                    product_service_description: psd,
                    source: 'historico',
                    status: getEffectivePurchaseStatus(inv, statusOverrides),
                });
             } else {
                 errors++;
             }
        }
    });

    // Pre-filter: check existing invoices using RUT normalization to skip duplicates
    if (invoicesToInsert.length > 0) {
        const { existingInvs, invSups } = await loadExistingDedupData();
        
        const sidToRut = new Map<string, string>();
        invSups?.forEach((s: any) => {
            if (s.rut) sidToRut.set(s.id, normalizeRut(s.rut));
        });
        
        const existingSet = new Set<string>();
        existingInvs?.forEach((inv: any) => {
            const nRut = sidToRut.get(inv.supplier_id);
            if (nRut && inv.invoice_number) {
                existingSet.add(`${nRut}-${inv.invoice_number}`);
            }
        });
        
        const filteredInvoices = invoicesToInsert.filter(inv => {
            const nRut = sidToRut.get(inv.supplier_id) || '';
            const key = `${nRut}-${inv.invoice_number}`;
            if (existingSet.has(key)) {
                logger.debug(`Omitiendo factura existente: ${inv.invoice_number}`);
                return false;
            }
            return true;
        });
        
        const skipped = invoicesToInsert.length - filteredInvoices.length;
        if (skipped > 0) {
            logger.debug(`${skipped} facturas omitidas por duplicado`);
        }

        setProgressTotal(filteredInvoices.length);
        setProgressCurrent(0);
        setProgressStage(
          filteredInvoices.length > 0
            ? (importDateLabel ? `Insertando facturas (${importDateLabel})...` : 'Insertando facturas...')
            : 'Sin facturas para importar'
        );

        const isMissingProductServiceDescriptionColumn = (message: string | null | undefined) => {
            const m = (message || '').toLowerCase();
            return m.includes("product_service_description") && (m.includes("could not find") || m.includes("schema cache"));
        };

        const stripProductServiceDescription = (row: any) => {
            if (!row || typeof row !== 'object') return row;
            const { product_service_description: _ignored, ...rest } = row;
            return rest;
        };

        // Simple batch insert (no upsert, no created_by)
        const batchSize = 50;
        for (let i = 0; i < filteredInvoices.length; i += batchSize) {
            const batch = filteredInvoices.slice(i, i + batchSize);
            const batchExampleDate = batch[0]?.issue_date ? formatDate(batch[0].issue_date) : '';
            const labelPrefix = importDateLabel ? `Insertando facturas (${importDateLabel})` : 'Insertando facturas';
            const labelSuffix = batchExampleDate ? ` — Ej: ${batchExampleDate}` : '';
            setProgressStage(`${labelPrefix} (${Math.min(i + batch.length, filteredInvoices.length)}/${filteredInvoices.length})${labelSuffix}...`);
            
            const { error } = await supabase
                .from('supplier_invoices')
                .insert(batch);

            if (error) {
                logger.error('Batch insert error, trying individually:', error);
                setLastError((prev) => prev ?? (error.message || 'Error desconocido al insertar facturas de compra'));
                toast.error('Error al importar compras', {
                  description: error.message || 'Error desconocido al insertar facturas de compra',
                });

                if (isMissingProductServiceDescriptionColumn(error.message)) {
                    const sanitizedBatch = batch.map(stripProductServiceDescription);
                    const { error: retryError } = await supabase
                        .from('supplier_invoices')
                        .insert(sanitizedBatch);
                    if (!retryError) {
                        imported += sanitizedBatch.length;
                        setProgressCurrent(prev => prev + batch.length);
                        continue;
                    }
                }
                
                // Fallback: insert one by one to identify specific failures
                for (const item of batch) {
                    const { error: singleError } = await supabase
                        .from('supplier_invoices')
                        .insert(item);

                    if (singleError) {
                        // Skip duplicate key errors silently
                        if (singleError.code === '23505') {
                            logger.debug(`Omitiendo duplicado: ${item.invoice_number}`);
                        } else {
                            logger.error('Failed to insert:', item.invoice_number, singleError);
                            setLastError((prev) => prev ?? (singleError.message || 'Error desconocido al insertar factura de compra'));
                            errors++;
                        }
                    } else {
                        imported++;
                    }
                }
            } else {
                imported += batch.length;
            }

            setProgressCurrent(prev => prev + batch.length);
        }
    }

    await persistImportArtifacts(imported, errors, preview, unmatchedSuppliers);
    setImportResult({ imported, errors });
    
    // Invalidate queries to refresh lists
    await queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
    await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    if (imported > 0) {
      onImportComplete();
    }
    
    setStep('done');
  };

  const totalToImport = getSelectedMatchedCount() + getSelectedUnmatchedCount() + getSelectedDuplicatesCount();
  const pendingUnmatchedSuppliers = useMemo(
    () => unmatchedSuppliers.filter((supplier) => supplier.resolution === 'pending'),
    [unmatchedSuppliers]
  );
  const allUnmatchedPending = unmatchedSuppliers.length > 0 && pendingUnmatchedSuppliers.length === unmatchedSuppliers.length;

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-w-4xl w-[95vw] overflow-clip flex flex-col ${step === 'preview' ? 'h-[85vh]' : 'max-h-[90vh]'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Importar Historial de Compras
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-emerald-600 bg-emerald-600/5' : 'border-muted-foreground/30 hover:border-emerald-600/50'}`}
            >
              <input
                {...getInputProps({
                  onClick: (event) => {
                    (event.currentTarget as HTMLInputElement).value = '';
                  },
                })}
              />
              <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">
                {isDragActive ? 'Suelta el archivo aquí...' : 'Arrastra tu archivo CSV o XLSX'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Archivo de reporte de compras (Libro de Compras)
              </p>
              <Button variant="outline" className="mt-4">
                Seleccionar archivo
              </Button>
            </div>

            <Card>
              <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileSpreadsheet className="size-4 text-emerald-600" />
                    Formatos aceptados
                  </div>
                  <p className="text-sm text-muted-foreground">`.csv`, `.xlsx`, `.xls`</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarRange className="size-4 text-emerald-600" />
                    Columnas esperadas
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Documento, Folio, Fecha, RUT, Razón Social, Neto, IVA, Total
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
                  <p className="text-xs text-muted-foreground">Con proveedor</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{preview.unmatched.length}</p>
                  <p className="text-xs text-muted-foreground">Sin proveedor</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{preview.duplicates.length}</p>
                  <p className="text-xs text-muted-foreground">Duplicados</p>
                </div>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Rango detectado: <span className="font-medium text-foreground">{formatDate(getPreviewDateRange(preview).start)} - {formatDate(getPreviewDateRange(preview).end)}</span>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
              <label className="flex min-h-9 items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  aria-label="Seleccionar todos los documentos importables"
                  checked={allImportableSelected ? true : someImportableSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => toggleAllImportable(checked === true)}
                />
                Seleccionar todos
                <span className="text-xs font-normal text-muted-foreground">({selectedImportableCount} seleccionados)</span>
              </label>
              <div className="flex flex-1 flex-col gap-1 sm:ml-auto sm:max-w-[230px]">
                <Label htmlFor="purchase-document-status" className="text-xs">Estado de documentos</Label>
                <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as PurchaseImportStatus)}>
                  <SelectTrigger id="purchase-document-status" aria-label="Estado de documentos de compra" className="h-9">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                    <SelectItem value="overdue">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="h-9" onClick={applyBulkStatus} disabled={!bulkStatus || selectedImportableCount === 0}>
                Aplicar estado
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-1 space-y-2">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="matched" className="flex-1">
                    Listas para importar ({preview.matched.length})
                  </TabsTrigger>
                  <TabsTrigger value="unmatched" className="relative flex-1">
                    Sin proveedor ({preview.unmatched.length})
                    {pendingUnmatchedSuppliers.length > 0 && (
                      <span className="absolute right-2 top-2 flex size-2 rounded-full bg-amber-500" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="duplicates" className="flex-1">
                    Duplicados ({preview.duplicates.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 min-h-0 mt-2 border rounded-md relative">
                <TabsContent value="matched" className="absolute inset-0 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                              <CheckCircle className="size-4 text-green-500" />
                              Facturas listas ({getSelectedMatchedCount()}/{preview.matched.length})
                            </h3>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                aria-label="Seleccionar todas las facturas listas"
                                checked={preview.matched.length > 0 && getSelectedMatchedCount() === preview.matched.length ? true : getSelectedMatchedCount() > 0 ? 'indeterminate' : false}
                                onCheckedChange={toggleAllMatched}
                              />
                              Seleccionar todas
                            </label>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30px]"></TableHead>
                                    <TableHead>Folio</TableHead>
                                    <TableHead>Proveedor</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {preview.matched.map((inv, i) => {
                                    const invoiceKey = getPurchaseImportKey(inv);
                                    const effectiveStatus = getEffectivePurchaseStatus(inv, statusOverrides);
                                    return (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <Checkbox
                                                aria-label={`Seleccionar documento ${inv.invoice_number}`}
                                                checked={selectedInvoices.has(invoiceKey)}
                                                onCheckedChange={() => toggleInvoice(invoiceKey)}
                                            />
                                        </TableCell>
                                        <TableCell>{inv.invoice_number}</TableCell>
                                        <TableCell>{inv.razonSocial}</TableCell>
                                        <TableCell>{inv.issueDate}</TableCell>
                                        <TableCell className="text-right">{formatCLP(inv.amount)}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getInvoiceStatusBadgeClass(effectiveStatus)}`}>
                                                {effectiveStatus === 'paid' ? 'Pagada' : effectiveStatus === 'overdue' ? 'Vencida' : 'Pendiente'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="unmatched" className="absolute inset-0 m-0">
                   <div className="h-full overflow-y-auto">
                    <div className="p-4 space-y-6">
                        {/* Unmatched Suppliers List */}
                        {unmatchedSuppliers.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium flex items-center gap-2">
                                        <Users className="size-4 text-amber-500" />
                                        Proveedores no encontrados ({unmatchedSuppliers.length}) — {preview?.unmatched.length} facturas
                                    </h3>
                                </div>

                                {allUnmatchedPending && (
                                  <Button
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleBulkAction('create')}
                                  >
                                    Crear todos como nuevos ({unmatchedSuppliers.length})
                                  </Button>
                                )}

                                {/* Bulk Action Header Card */}
                                <div className="bg-background border rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <Checkbox 
                                                checked={selectedUnmatchedSupplierIndices.size > 0 && selectedUnmatchedSupplierIndices.size === unmatchedSuppliers.length}
                                                onCheckedChange={(checked) => selectAllUnmatchedSuppliers(!!checked)}
                                            />
                                            <span className="text-sm font-medium">
                                                {selectedUnmatchedSupplierIndices.size} seleccionados
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 gap-2"
                                                onClick={() => handleBulkAction('create')}
                                                disabled={selectedUnmatchedSupplierIndices.size === 0}
                                            >
                                                <UserPlus className="size-3.5" />
                                                Crear
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 gap-2"
                                                onClick={handleBulkAssign}
                                                disabled={selectedUnmatchedSupplierIndices.size === 0}
                                            >
                                                <Users className="size-3.5" />
                                                Asignar
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 gap-2 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleBulkAction('ignore')}
                                                disabled={selectedUnmatchedSupplierIndices.size === 0}
                                            >
                                                <Ban className="size-3.5" />
                                                Ignorar
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    {unmatchedSuppliers.map((us, i) => (
                                        <div
                                          key={us.rut}
                                          className={`flex flex-col rounded-lg border bg-card p-4 transition-colors ${
                                            selectedUnmatchedSupplierIndices.has(i) ? 'border-primary/50 bg-primary/5' : ''
                                          } ${
                                            us.suggestion && us.suggestion.score > 0.75 && us.assignedSupplierId === us.suggestion.supplierId
                                              ? 'border-emerald-200 bg-emerald-50/40'
                                              : ''
                                          } ${
                                            us.resolution === 'ignore' ? 'opacity-60' : 'hover:border-primary/50'
                                          }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Checkbox 
                                                    className="mt-1"
                                                    checked={selectedUnmatchedSupplierIndices.has(i)}
                                                    onCheckedChange={() => toggleUnmatchedSupplierSelection(i)}
                                                />
                                                <div className="flex-1 gap-y-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-1">
                                                            {editingSupplierIndex === i ? (
                                                                <div className="flex items-center gap-2">
                                                                    <Input 
                                                                        value={editSupplierForm.name}
                                                                        onChange={(e) => setEditSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                                                                        className="h-8 w-[300px]"
                                                                        autoFocus
                                                                        onBlur={() => setEditSupplierForm(prev => ({ ...prev, name: toTitleCase(prev.name) }))}
                                                                        onKeyDown={(e) => e.key === 'Enter' && saveQuickEdit()}
                                                                    />
                                                                    <Button size="icon" variant="ghost" className="size-8" onClick={saveQuickEdit}>
                                                                        <Check className="size-4 text-green-500" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 flex-wrap group">
                                                                    <span className="font-medium text-lg">{toTitleCase(us.razonSocial)}</span>
                                                                    {us.autoResolvedByMapping && (
                                                                      <TooltipProvider>
                                                                        <Tooltip>
                                                                          <TooltipTrigger asChild>
                                                                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 p-1 text-emerald-600">
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
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        onClick={() => openQuickEdit(i)}
                                                                    >
                                                                        <Edit2 className="size-3.5 text-muted-foreground" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                                                <span>RUT: {us.rut}</span>
                                                                <span>—</span>
                                                                <span>{us.invoiceCount} facturas</span>
                                                                <span>—</span>
                                                                <span className="font-medium text-foreground">{formatCLP(us.totalAmount)}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div>
                                                          <ResolutionBadge resolution={us.resolution} />
                                                        </div>
                                                    </div>

                                                    {us.suggestion && us.suggestion.score > 0.75 && us.assignedSupplierId === us.suggestion.supplierId && (
                                                      <div className="ml-8 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                                        <span className="inline-flex items-center gap-2">
                                                          <Sparkles className="size-3.5" />
                                                          Sugerencia preseleccionada: <strong>{us.suggestion.name}</strong> ({(us.suggestion.score * 100).toFixed(0)}%)
                                                        </span>
                                                      </div>
                                                    )}

                                                    {us.suggestion && us.suggestion.score <= 0.75 && us.resolution === 'pending' && (
                                                      <div className="ml-8 flex items-center justify-between gap-2 rounded border border-amber-200/50 bg-amber-50/50 p-2">
                                                        <div className="flex items-center gap-2 text-xs text-amber-800">
                                                          <Sparkles className="size-3.5" />
                                                          <span>
                                                            Sugerencia: <strong>{us.suggestion.name}</strong> ({(us.suggestion.score * 100).toFixed(0)}%)
                                                          </span>
                                                        </div>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-6 text-xs text-amber-700 hover:bg-amber-100"
                                                          onClick={() => applySuggestion(i)}
                                                        >
                                                          Aplicar
                                                        </Button>
                                                      </div>
                                                    )}

                                                    <div className="ml-8 flex flex-wrap items-center gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            variant={us.resolution === 'create' ? "default" : "outline"}
                                                            className="h-8 gap-2"
                                                            onClick={() => handleSupplierResolution(i, 'create')}
                                                        >
                                                            <UserPlus className="size-3.5" />
                                                            Crear
                                                        </Button>
                                                        
                                                        <div className="flex items-center gap-1">
                                                          <Button 
                                                              size="sm" 
                                                              variant={us.resolution === 'assign' ? "default" : "outline"}
                                                              className="h-8 gap-2"
                                                              onClick={() => {
                                                                if (us.resolution !== 'assign') {
                                                                  handleSupplierResolution(i, 'assign', us.suggestion?.supplierId);
                                                                }
                                                              }}
                                                          >
                                                              <Users className="size-3.5" />
                                                              Asignar
                                                          </Button>
                                                          {us.resolution === 'assign' && (
                                                            <Select
                                                              value={us.assignedSupplierId || ''}
                                                              onValueChange={(value) => handleSupplierResolution(i, 'assign', value)}
                                                            >
                                                              <SelectTrigger className="h-8 w-[220px] text-xs">
                                                                <SelectValue placeholder="Seleccionar proveedor..." />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                {suppliers.filter((supplier) => supplier.is_active).map((supplier) => (
                                                                  <SelectItem key={supplier.id} value={supplier.id} className="text-xs">
                                                                    {supplier.name} ({supplier.rut || 'Sin RUT'})
                                                                  </SelectItem>
                                                                ))}
                                                              </SelectContent>
                                                            </Select>
                                                          )}
                                                        </div>

                                                        <Button 
                                                            size="sm" 
                                                            variant={us.resolution === 'ignore' ? "destructive" : "outline"}
                                                            className={`h-8 gap-2 ${us.resolution !== 'ignore' ? 'text-muted-foreground hover:text-destructive' : ''}`}
                                                            onClick={() => handleSupplierResolution(i, 'ignore')}
                                                        >
                                                            <Ban className="size-3.5" />
                                                            Ignorar
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <Separator />

                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                              <AlertTriangle className="size-4 text-amber-500" />
                              Facturas sin asignar ({getSelectedUnmatchedCount()}/{preview.unmatched.length})
                            </h3>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                aria-label="Seleccionar todas las facturas con proveedor resuelto"
                                checked={preview.unmatched.length > 0 && getSelectedUnmatchedCount() === preview.unmatched.filter(inv => {
                                    const nRut = normalizeRut(inv.rut);
                                    const us = unmatchedSuppliers.find(s => normalizeRut(s.rut) === nRut);
                                    return !!us && (us.resolution === 'create' || us.resolution === 'assign');
                                }).length ? true : getSelectedUnmatchedCount() > 0 ? 'indeterminate' : false}
                                onCheckedChange={toggleAllUnmatched}
                              />
                              Seleccionar disponibles
                            </label>
                        </div>
                        
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30px]"></TableHead>
                                    <TableHead>Folio</TableHead>
                                    <TableHead>Proveedor (RUT)</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {preview.unmatched.map((inv, i) => {
                                    const nRut = normalizeRut(inv.rut);
                                    const us = unmatchedSuppliers.find(s => normalizeRut(s.rut) === nRut);
                                    const isResolvable = us && (us.resolution === 'create' || us.resolution === 'assign');
                                    const invoiceKey = getPurchaseImportKey(inv);
                                    const effectiveStatus = getEffectivePurchaseStatus(inv, statusOverrides);
                                    
                                    return (
                                    <TableRow key={i} className={!isResolvable ? 'opacity-50 bg-muted/50' : ''}>
                                        <TableCell>
                                            <Checkbox
                                                aria-label={`Seleccionar documento ${inv.invoice_number}`}
                                                checked={selectedInvoices.has(invoiceKey)}
                                                onCheckedChange={() => toggleInvoice(invoiceKey)}
                                                disabled={!isResolvable}
                                            />
                                        </TableCell>
                                        <TableCell>{inv.invoice_number}</TableCell>
                                        <TableCell>
                                            <div>{toTitleCase(inv.razonSocial)}</div>
                                            <div className="text-xs text-muted-foreground">{inv.rut}</div>
                                        </TableCell>
                                        <TableCell>{inv.issueDate}</TableCell>
                                        <TableCell className="text-right">{formatCLP(inv.amount)}</TableCell>
                                        <TableCell>
                                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getInvoiceStatusBadgeClass(effectiveStatus)}`}>
                                            {effectiveStatus === 'paid' ? 'Pagada' : effectiveStatus === 'overdue' ? 'Vencida' : 'Pendiente'}
                                          </span>
                                        </TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                    </div>
                   </div>
                </TabsContent>
                
                <TabsContent value="duplicates" className="absolute inset-0 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                              <Ban className="size-4 text-muted-foreground" />
                              Duplicados ({getSelectedDuplicatesCount()}/{preview.duplicates.length})
                            </h3>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                aria-label="Seleccionar todos los duplicados"
                                checked={preview.duplicates.length > 0 && getSelectedDuplicatesCount() === preview.duplicates.length ? true : getSelectedDuplicatesCount() > 0 ? 'indeterminate' : false}
                                onCheckedChange={toggleAllDuplicates}
                              />
                              Seleccionar todos
                            </label>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30px]"></TableHead>
                                    <TableHead>Folio</TableHead>
                                    <TableHead>Proveedor</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {preview.duplicates.map((inv) => {
                                  const invoiceKey = getPurchaseImportKey(inv);
                                  const effectiveStatus = getEffectivePurchaseStatus(inv, statusOverrides);
                                  return (
                                    <TableRow key={invoiceKey}>
                                        <TableCell>
                                            <Checkbox
                                                aria-label={`Seleccionar documento duplicado ${inv.invoice_number}`}
                                                checked={selectedInvoices.has(invoiceKey)}
                                                onCheckedChange={() => toggleInvoice(invoiceKey)}
                                            />
                                        </TableCell>
                                        <TableCell>{inv.invoice_number}</TableCell>
                                        <TableCell>{toTitleCase(inv.razonSocial)}</TableCell>
                                        <TableCell>{inv.issueDate}</TableCell>
                                        <TableCell className="text-right">{formatCLP(inv.amount)}</TableCell>
                                        <TableCell>
                                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getInvoiceStatusBadgeClass(effectiveStatus)}`}>
                                            {effectiveStatus === 'paid' ? 'Pagada' : effectiveStatus === 'overdue' ? 'Vencida' : 'Pendiente'}
                                          </span>
                                        </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Loader2 className="size-12 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-medium">Importando facturas...</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Esto puede tomar unos momentos. Por favor no cierres esta ventana.
            </p>
            <div className="w-full max-w-md mt-6 space-y-2">
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
          <div className="flex flex-col items-center justify-center p-12 text-center">
            {importResult.imported === 0 && importResult.errors > 0 ? (
              <AlertTriangle className="mb-4 size-12 text-destructive" />
            ) : (
              <CheckCircle className="mb-4 size-12 text-green-500" />
            )}
            <h3 className="text-lg font-medium">
              {importResult.imported === 0 && importResult.errors > 0
                ? 'Error en la importación'
                : 'Importación completada'}
            </h3>
            <div className="mt-4 space-y-1">
              <p className="text-sm text-muted-foreground">
                {importResult.imported === 0 && importResult.errors > 0
                  ? 'No se importaron facturas.'
                  : `Se importaron ${importResult.imported} facturas correctamente.`}
              </p>
              {importResult.errors > 0 && (
                <p className="text-sm text-destructive">
                  Hubo {importResult.errors} errores durante la importación.
                </p>
              )}
            </div>
            {lastError && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive text-xs rounded max-w-md mx-auto overflow-auto max-h-32">
                {lastError}
              </div>
            )}
            <Button className="mt-6" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        )}

        <DialogFooter className="mt-4 flex-none border-t pt-4">
          {step === 'preview' && (
            <div className="flex justify-between w-full items-center">
              <div className="text-sm text-muted-foreground">
                {totalToImport} seleccionadas
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetState} className="gap-2">
                  <RotateCw className="size-4" />
                  Seleccionar otro archivo
                </Button>
                <Button variant="ghost" onClick={handleClose}>
                  Cerrar
                </Button>
                <Button onClick={handleImport} disabled={!canImport()}>
                  Importar {totalToImport} documento{totalToImport !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Simple Create Supplier Dialog */}
    <Dialog open={isCreatingSupplier} onOpenChange={setIsCreatingSupplier}>
        <DialogContent className="overflow-clip">
            <DialogHeader>
                <DialogTitle>Crear Proveedor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rut" className="text-right">RUT</Label>
                    <Input id="rut" value={newSupplierData.rut} onChange={e => setNewSupplierData({...newSupplierData, rut: formatRut(e.target.value)})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Nombre</Label>
                    <Input id="name" value={newSupplierData.name} onChange={e => setNewSupplierData({...newSupplierData, name: e.target.value})} className="col-span-3" />
                </div>
                {/* Simplified form for quick creation */}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreatingSupplier(false)}>Cancelar</Button>
                <Button onClick={handleCreateSupplier}>Guardar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {/* Bulk Assign Dialog */}
    <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
      <DialogContent className="w-[min(95vw,28rem)] overflow-clip">
        <DialogHeader>
          <DialogTitle>Asignar Proveedor Existente</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Label className="mb-2 block">Seleccionar Proveedor</Label>
          <Select value={bulkAssignSupplierId} onValueChange={setBulkAssignSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Buscar proveedor..." />
            </SelectTrigger>
            <SelectContent>
                <ScrollArea className="h-[200px]">
                    {suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name} ({supplier.rut})
                        </SelectItem>
                    ))}
                </ScrollArea>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>Cancelar</Button>
          <Button onClick={confirmBulkAssign}>Asignar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default PurchaseHistoryImport;

const ResolutionBadge: React.FC<{ resolution: string }> = ({ resolution }) => {
  switch (resolution) {
    case 'create':
      return <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Crear nuevo</span>;
    case 'assign':
      return <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Asignado</span>;
    case 'ignore':
      return <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Ignorado</span>;
    default:
      return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pendiente</span>;
  }
};
