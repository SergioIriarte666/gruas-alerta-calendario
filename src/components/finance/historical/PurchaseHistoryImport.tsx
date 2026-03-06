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
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Loader2, UserPlus, Users, Ban, Edit2, Sparkles, Trash2, ArrowRight, Check } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { stringSimilarity, toTitleCase } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  parseCSVFile,
  parseXLSXFile,
  processPurchaseRows,
  PurchaseImportPreview,
  UnmatchedSupplier,
  ProcessedPurchase,
} from '@/utils/purchaseHistoryParser';
import { Supplier } from '@/types/suppliers';

interface PurchaseHistoryImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const formatCLP = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

const normalizeRut = (rut: string): string =>
  rut.replace(/[^0-9Kk]/g, '').trim().toUpperCase();

const PurchaseHistoryImport: React.FC<PurchaseHistoryImportProps> = ({ open, onOpenChange, onImportComplete }) => {
  const { suppliers } = useSuppliers();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [activeTab, setActiveTab] = useState('matched');
  const [preview, setPreview] = useState<PurchaseImportPreview | null>(null);
  const [unmatchedSuppliers, setUnmatchedSuppliers] = useState<UnmatchedSupplier[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedUnmatchedSupplierIndices, setSelectedUnmatchedSupplierIndices] = useState<Set<number>>(new Set());
  const [editingSupplierIndex, setEditingSupplierIndex] = useState<number | null>(null);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkAssignSupplierId, setBulkAssignSupplierId] = useState<string>('');
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
            
            // Threshold for suggestion (e.g., 0.6)
            if (bestMatch.score > 0.6) {
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
      preview.matched.forEach((inv, i) => allKeys.add(`matched-${inv.invoice_number}-${i}`));
      // Don't auto-select unmatched invoices until they are resolved
      setSelectedInvoices(allKeys);
    }
  }, [preview]);

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
      return prev.map((us, i) => {
        if (selectedUnmatchedSupplierIndices.has(i)) {
          return { ...us, resolution: action, assignedSupplierId };
        }
        return us;
      });
    });
    
    // Auto-select invoices for resolved suppliers
    if (preview && action !== 'ignore') {
       const indicesToSelect: string[] = [];
       preview.unmatched.forEach((inv, i) => {
           const nRut = normalizeRut(inv.rut);
           // Find if this invoice belongs to one of the resolved suppliers
           const supplierIndex = unmatchedSuppliers.findIndex(s => normalizeRut(s.rut) === nRut);
           if (selectedUnmatchedSupplierIndices.has(supplierIndex)) {
               indicesToSelect.push(`unmatched-${inv.invoice_number}-${i}`);
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
           const supplierIndex = unmatchedSuppliers.findIndex(s => normalizeRut(s.rut) === nRut);
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

  const handleSupplierResolution = (index: number, resolution: 'create' | 'assign' | 'ignore', assignedSupplierId?: string) => {
    setUnmatchedSuppliers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], resolution, assignedSupplierId };
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
        resolution: 'create' // Auto-set to create after edit
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
                indicesToSelect.push(`unmatched-${inv.invoice_number}-${i}`);
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
    setActiveTab('matched');
    setIsCreatingSupplier(false);
    setSelectedUnmatchedSupplierIndices(new Set());
    setEditingSupplierIndex(null);
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
        .from('supplier_invoices')
        .select('invoice_number, supplier:suppliers(rut)')
        .not('invoice_number', 'is', null);

      const existingKeys = new Set<string>();
      
      existingInvoices?.forEach((inv: any) => {
        if (inv.invoice_number && inv.supplier?.rut) {
          const nRut = normalizeRut(inv.supplier.rut);
          existingKeys.add(`${nRut}-${inv.invoice_number}`);
        }
      });

      const result = processPurchaseRows(rows, suppliers, existingKeys);
      setPreview(result);
      setUnmatchedSuppliers(result.unmatchedSuppliers);
      setStep('preview');
      
      // Auto-switch to unmatched tab if there are unmatched suppliers
      if (result.unmatchedSuppliers.length > 0) {
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
      toast.error('Error al leer el archivo', { description: 'Verifica el formato.' });
    }
  }, [suppliers]);

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
        const key = `matched-${inv.invoice_number}-${i}`;
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
        const uc = unmatchedSuppliers.find(c => normalizeRut(c.rut) === nRut);
        
        // Only select if resolved (created or assigned)
        if (uc && (uc.resolution === 'create' || uc.resolution === 'assign')) {
           const key = `unmatched-${inv.invoice_number}-${i}`;
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
        const key = `duplicate-${inv.invoice_number}-${i}`;
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const getSelectedMatchedCount = () => {
    if (!preview) return 0;
    return preview.matched.filter((inv, i) => selectedInvoices.has(`matched-${inv.invoice_number}-${i}`)).length;
  };

  const getSelectedUnmatchedCount = () => {
    if (!preview) return 0;
    return preview.unmatched.filter((inv, i) => {
      const key = `unmatched-${inv.invoice_number}-${i}`;
      if (!selectedInvoices.has(key)) return false;
      const nRut = normalizeRut(inv.rut);
      const us = unmatchedSuppliers.find(s => normalizeRut(s.rut) === nRut);
      return !!us && (us.resolution === 'create' || us.resolution === 'assign');
    }).length;
  };

  const getSelectedDuplicatesCount = () => {
    if (!preview) return 0;
    return preview.duplicates.filter((inv, i) => selectedInvoices.has(`duplicate-${inv.invoice_number}-${i}`)).length;
  };

  const canImport = () => {
    if (!preview) return false;
    return (getSelectedMatchedCount() + getSelectedUnmatchedCount() + getSelectedDuplicatesCount()) > 0;
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierData.rut || !newSupplierData.name) {
      toast.error('RUT y Nombre son obligatorios');
      return;
    }
    
    // Optimistic update for UI
    const nRut = normalizeRut(newSupplierData.rut);
    
    setUnmatchedSuppliers(prev => prev.map(us => {
      if (normalizeRut(us.rut) === nRut) {
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
            if (normalizeRut(inv.rut) === nRut) {
                indicesToSelect.push(`unmatched-${inv.invoice_number}-${i}`);
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

  const openCreateSupplier = (rut: string, name: string) => {
    setNewSupplierData({
        rut,
        name,
        category: 'General',
        contactName: '',
        email: '',
        phone: ''
    });
    setIsCreatingSupplier(true);
  };

  const handleImport = async () => {
    if (!preview) return;

    setStep('importing');
    setImporting(true);
    setLastError(null);

    let imported = 0;
    let errors = 0;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    
    // 1. Prepare supplier mapping (RUT -> ID) for creation or assignment
    // Map includes newly created suppliers AND assigned existing suppliers
    const supplierRutToId = new Map<string, string>();

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
                
                // @ts-ignore - inventory_suppliers missing in types but exists in DB
                const { data: existingInvSup } = await (supabase as any)
                    .from('inventory_suppliers')
                    .select('id')
                    .eq('rut', us.rut)
                    .maybeSingle();

                if (existingInvSup) {
                    inventorySupplierId = existingInvSup.id;
                } else {
                    // Create in inventory_suppliers
                    // @ts-ignore
                    const { data: newInvSup, error: invSupError } = await (supabase as any)
                        .from('inventory_suppliers')
                        .insert({
                            name: us.razonSocial,
                            rut: us.rut,
                            is_active: true,
                            contact_name: '', // Optional defaults
                            phone: '',
                            email: ''
                        })
                        .select('id')
                        .single();
                    
                    if (invSupError) {
                        console.error('Error creating inventory_supplier:', invSupError);
                        // If this fails, we can't insert invoices for this supplier due to FK
                        errors++; 
                        continue;
                    }
                    inventorySupplierId = newInvSup.id;
                }

                // B. Handle public.suppliers (For UI consistency)
                // We do this 'best effort' - if it fails, we don't block the import
                try {
                    const { data: existingSup } = await supabase
                        .from('suppliers')
                        .select('id')
                        .eq('rut', us.rut)
                        .maybeSingle();
                    
                    if (!existingSup) {
                         const { error: supError } = await supabase
                            .from('suppliers')
                            .insert({
                                name: us.razonSocial,
                                rut: us.rut,
                                category: 'General',
                                created_by: userId,
                                is_active: true
                            });
                         if (supError && !supError.message?.includes('duplicate')) {
                             // Fallback for created_by
                             if (supError.message?.includes('created_by')) {
                                 await supabase.from('suppliers').insert({
                                    name: us.razonSocial,
                                    rut: us.rut,
                                    category: 'General',
                                    is_active: true
                                 });
                             } else {
                                 console.warn('Could not sync to suppliers table:', supError);
                             }
                         }
                    }
                } catch (e) {
                    console.warn('Error syncing to suppliers table:', e);
                }

                // Map the RUT to the INVENTORY_SUPPLIER ID because that's what the invoice table references
                if (inventorySupplierId) {
                    supplierRutToId.set(nRut, inventorySupplierId);
                }

            } catch (err) {
                console.error(`Error processing supplier ${us.rut}:`, err);
                errors++;
            }
        } else if (us.resolution === 'assign' && us.assignedSupplierId) {
            // If assigned, we assume the user selected a supplier from the list (which comes from 'suppliers' table).
            // BUT, we need the ID from 'inventory_suppliers' if the FK points there.
            
            const nRut = normalizeRut(us.rut); // The RUT from the file
            
            // Try to find in inventory_suppliers by RUT
            // @ts-ignore
            const { data: existingInvSup } = await (supabase as any)
                .from('inventory_suppliers')
                .select('id')
                .eq('rut', us.rut) 
                .maybeSingle();
            
            if (existingInvSup) {
                supplierRutToId.set(nRut, existingInvSup.id);
            } else {
                // If not found in inventory_suppliers, we must create it there too!
                try {
                    // @ts-ignore
                    const { data: newInvSup, error: invSupError } = await (supabase as any)
                        .from('inventory_suppliers')
                        .insert({
                            name: us.razonSocial,
                            rut: us.rut,
                            is_active: true
                        })
                        .select('id')
                        .single();
                        
                    if (!invSupError && newInvSup) {
                        supplierRutToId.set(nRut, newInvSup.id);
                    } else {
                        console.error('Failed to create missing inventory_supplier for assigned supplier:', invSupError);
                        // Fallback: try using the assigned ID directly
                        supplierRutToId.set(nRut, us.assignedSupplierId);
                    }
                } catch (e) {
                    supplierRutToId.set(nRut, us.assignedSupplierId);
                }
            }
        }
    }

    // 2. Prepare invoices to insert
    const invoicesToInsert: any[] = [];
    
    // Matched invoices
    preview.matched.forEach((inv, i) => {
        const key = `matched-${inv.invoice_number}-${i}`;
        if (selectedInvoices.has(key) && inv.supplierId) {
            invoicesToInsert.push({
                invoice_number: inv.invoice_number,
                supplier_id: inv.supplierId,
                issue_date: inv.issueDate,
                due_date: inv.dueDate,
                amount: inv.amount,
                tax_amount: inv.tax_amount,
                net_amount: inv.net_amount,
                status: inv.status,
                description: inv.description,
                created_by: userId
            });
        }
    });

    // Unmatched invoices (now resolved)
    preview.unmatched.forEach((inv, i) => {
        const key = `unmatched-${inv.invoice_number}-${i}`;
        if (selectedInvoices.has(key)) {
            const nRut = normalizeRut(inv.rut);
            
            // Check if this supplier was ignored
            const us = unmatchedSuppliers.find(s => normalizeRut(s.rut) === nRut);
            if (us?.resolution === 'ignore') return;

            // Try to find resolved ID
            const supplierId = supplierRutToId.get(nRut);
            
            if (supplierId) {
                invoicesToInsert.push({
                    invoice_number: inv.invoice_number,
                    supplier_id: supplierId,
                    issue_date: inv.issueDate,
                    due_date: inv.dueDate,
                    amount: inv.amount,
                    tax_amount: inv.tax_amount,
                    net_amount: inv.net_amount,
                    status: inv.status,
                    description: inv.description,
                    created_by: userId
                });
            } else {
                console.warn(`Skipping invoice ${inv.invoice_number}: Supplier not resolved for RUT ${inv.rut}`);
                errors++;
            }
        }
    });
    
    // Duplicate invoices
    preview.duplicates.forEach((inv, i) => {
        const key = `duplicate-${inv.invoice_number}-${i}`;
        if (selectedInvoices.has(key)) {
             let supplierId = inv.supplierId;
             
             // If duplicate didn't have supplier matched initially, check resolved map
             if (!supplierId) {
                 const nRut = normalizeRut(inv.rut);
                 supplierId = supplierRutToId.get(nRut);
             }

             if (supplierId) {
                invoicesToInsert.push({
                    invoice_number: inv.invoice_number,
                    supplier_id: supplierId,
                    issue_date: inv.issueDate,
                    due_date: inv.dueDate,
                    amount: inv.amount,
                    tax_amount: inv.tax_amount,
                    net_amount: inv.net_amount,
                    status: inv.status,
                    description: inv.description,
                    created_by: userId
                });
             } else {
                 errors++;
             }
        }
    });

        // Batch insert/upsert
        const batchSize = 50;
        for (let i = 0; i < invoicesToInsert.length; i += batchSize) {
            const batch = invoicesToInsert.slice(i, i + batchSize);
            
            // Intento 1: Upsert completo
            let { error } = await supabase
                .from('supplier_invoices')
                .upsert(batch, { onConflict: 'supplier_id,invoice_number' }); 
            
            let method = 'upsert';

            // Si falla por falta de constraint unique (42P10), cambiamos a insert
            if (error && (error.code === '42P10' || error.message?.includes('constraint') || error.message?.includes('conflict'))) {
                 method = 'insert';
                 const retry = await supabase
                    .from('supplier_invoices')
                    .insert(batch);
                 error = retry.error;
            }

            // Fallback: Si falla por columna created_by inexistente
            if (error && (error.message?.includes('column "created_by" does not exist') || error.message?.includes("Could not find the 'created_by' column"))) {
                const cleanBatch = batch.map(({ created_by, ...rest }: any) => rest);
                if (method === 'upsert') {
                    const retry = await supabase
                        .from('supplier_invoices')
                        .upsert(cleanBatch, { onConflict: 'supplier_id,invoice_number' });
                    error = retry.error;
                    // Si falla upsert de nuevo por constraint, intentar insert
                    if (error && (error.code === '42P10' || error.message?.includes('constraint'))) {
                        method = 'insert';
                        const retryInsert = await supabase.from('supplier_invoices').insert(cleanBatch);
                        error = retryInsert.error;
                    }
                } else {
                    const retry = await supabase
                        .from('supplier_invoices')
                        .insert(cleanBatch);
                    error = retry.error;
                }
            }
            
            // Si sigue habiendo error (ej: FK, o cualquier otro), intentamos uno por uno
            if (error) {
                console.error('Batch error, trying individual items:', error);
                
                for (const item of batch) {
                    let singleError;
                    
                    // Intentar con el método que decidimos (upsert o insert)
                    if (method === 'upsert') {
                         const res = await supabase
                             .from('supplier_invoices')
                             .upsert(item, { onConflict: 'supplier_id,invoice_number' });
                         singleError = res.error;
                         
                         // Si falla upsert individual por constraint, cambiar a insert para este item
                         if (singleError && singleError.code === '42P10') {
                             const resInsert = await supabase.from('supplier_invoices').insert(item);
                             singleError = resInsert.error;
                         }
                    } else {
                         const res = await supabase.from('supplier_invoices').insert(item);
                         singleError = res.error;
                    }

                    // Si falla, intentar sin created_by
                    if (singleError && (singleError.message?.includes('created_by'))) {
                        const { created_by, ...cleanItem } = item;
                        if (method === 'upsert' && singleError.code !== '42P10') {
                            const res = await supabase
                                .from('supplier_invoices')
                                .upsert(cleanItem, { onConflict: 'supplier_id,invoice_number' });
                            singleError = res.error;
                        } else {
                            const res = await supabase.from('supplier_invoices').insert(cleanItem);
                            singleError = res.error;
                        }
                    }

                    if (singleError) {
                        console.error('Failed to insert single item:', item.invoice_number, singleError);
                        errors++;
                    } else {
                        imported++;
                    }
                }
            } else {
                imported += batch.length;
            }
        }

    setImportResult({ imported, errors });
    setImporting(false);
    
    // Invalidate queries to refresh lists
    await queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
    await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    
    setStep('done');
  };

  const invoicesToInsertCount = () => {
      return getSelectedMatchedCount() + getSelectedUnmatchedCount() + getSelectedDuplicatesCount();
  };

  const totalToImport = getSelectedMatchedCount() + getSelectedUnmatchedCount() + getSelectedDuplicatesCount();

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-w-4xl overflow-hidden flex flex-col ${step === 'preview' ? 'h-[85vh]' : 'max-h-[90vh]'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Historial de Compras
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
              Archivo de reporte de compras (Libro de Compras)
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
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-1">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="matched" className="flex-1">
                    Listas para importar ({preview.matched.length})
                  </TabsTrigger>
                  <TabsTrigger value="unmatched" className="flex-1">
                    Sin proveedor ({preview.unmatched.length})
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
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Facturas listas ({getSelectedMatchedCount()}/{preview.matched.length})
                            </h3>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={preview.matched.length > 0 && getSelectedMatchedCount() === preview.matched.length}
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
                                {preview.matched.map((inv, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedInvoices.has(`matched-${inv.invoice_number}-${i}`)}
                                                onCheckedChange={() => toggleInvoice(`matched-${inv.invoice_number}-${i}`)}
                                            />
                                        </TableCell>
                                        <TableCell>{inv.invoice_number}</TableCell>
                                        <TableCell>{inv.razonSocial}</TableCell>
                                        <TableCell>{inv.issueDate}</TableCell>
                                        <TableCell className="text-right">{formatCLP(inv.amount)}</TableCell>
                                        <TableCell>
                                            <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'secondary'}>
                                                {inv.status === 'paid' ? 'Pagada' : inv.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="unmatched" className="absolute inset-0 m-0">
                   <ScrollArea className="h-full">
                    <div className="p-4 space-y-6">
                        {/* Unmatched Suppliers List */}
                        {unmatchedSuppliers.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium flex items-center gap-2">
                                        <Users className="h-4 w-4 text-amber-500" />
                                        Proveedores no encontrados ({unmatchedSuppliers.length}) — {preview?.unmatched.length} facturas
                                    </h3>
                                </div>

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
                                                <UserPlus className="h-3.5 w-3.5" />
                                                Crear
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 gap-2"
                                                onClick={handleBulkAssign}
                                                disabled={selectedUnmatchedSupplierIndices.size === 0}
                                            >
                                                <Users className="h-3.5 w-3.5" />
                                                Asignar
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 gap-2 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleBulkAction('ignore')}
                                                disabled={selectedUnmatchedSupplierIndices.size === 0}
                                            >
                                                <Ban className="h-3.5 w-3.5" />
                                                Ignorar
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    {unmatchedSuppliers.map((us, i) => (
                                        <div key={i} className={`flex flex-col p-4 bg-card rounded-lg border transition-colors ${us.resolution === 'ignore' ? 'opacity-60 bg-muted/50' : 'hover:border-primary/50'}`}>
                                            <div className="flex items-start gap-3">
                                                <Checkbox 
                                                    className="mt-1"
                                                    checked={selectedUnmatchedSupplierIndices.has(i)}
                                                    onCheckedChange={() => toggleUnmatchedSupplierSelection(i)}
                                                />
                                                <div className="flex-1 space-y-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-1">
                                                            {editingSupplierIndex === i ? (
                                                                <div className="flex items-center gap-2">
                                                                    <Input 
                                                                        value={editSupplierForm.name}
                                                                        onChange={(e) => setEditSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                                                                        className="h-8 w-[300px]"
                                                                        autoFocus
                                                                        onKeyDown={(e) => e.key === 'Enter' && saveQuickEdit()}
                                                                    />
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveQuickEdit}>
                                                                        <Check className="h-4 w-4 text-green-500" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 group">
                                                                    <span className="font-medium text-lg">{us.razonSocial}</span>
                                                                    <Button 
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        onClick={() => openQuickEdit(i)}
                                                                    >
                                                                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <span>RUT: {us.rut}</span>
                                                                <span>—</span>
                                                                <span>{us.invoiceCount} facturas</span>
                                                                <span>—</span>
                                                                <span className="font-medium text-foreground">{formatCLP(us.totalAmount)}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Status Badge */}
                                                        <div>
                                                            {us.resolution === 'create' && (
                                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                                                                    <UserPlus className="h-3 w-3" /> Se creará
                                                                </Badge>
                                                            )}
                                                            {us.resolution === 'assign' && (
                                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                                                                    <Users className="h-3 w-3" /> Asignado
                                                                </Badge>
                                                            )}
                                                            {us.resolution === 'ignore' && (
                                                                <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
                                                                    <Ban className="h-3 w-3" /> Ignorado
                                                                </Badge>
                                                            )}
                                                            {us.resolution === 'pending' && (
                                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                                    Pendiente
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            variant={us.resolution === 'create' ? "default" : "outline"}
                                                            className="h-8 gap-2"
                                                            onClick={() => handleSupplierResolution(i, 'create')}
                                                        >
                                                            <UserPlus className="h-3.5 w-3.5" />
                                                            Crear
                                                        </Button>
                                                        
                                                        <Button 
                                                            size="sm" 
                                                            variant={us.resolution === 'assign' ? "default" : "outline"}
                                                            className="h-8 gap-2"
                                                            // For individual assign, we could open a dialog, but for now let's reuse bulk or just set logic
                                                            // Ideally individual assign needs a selector. Let's trigger the bulk dialog but pre-select just this one if we had logic for that, 
                                                            // or simpler: just toggle selection and open dialog.
                                                            onClick={() => {
                                                                setSelectedUnmatchedSupplierIndices(new Set([i]));
                                                                setBulkAssignDialogOpen(true);
                                                            }}
                                                        >
                                                            <Users className="h-3.5 w-3.5" />
                                                            Asignar
                                                        </Button>

                                                        <Button 
                                                            size="sm" 
                                                            variant={us.resolution === 'ignore' ? "destructive" : "outline"}
                                                            className={`h-8 gap-2 ${us.resolution !== 'ignore' ? 'text-muted-foreground hover:text-destructive' : ''}`}
                                                            onClick={() => handleSupplierResolution(i, 'ignore')}
                                                        >
                                                            <Ban className="h-3.5 w-3.5" />
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
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              Facturas sin asignar ({getSelectedUnmatchedCount()}/{preview.unmatched.length})
                            </h3>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={preview.unmatched.length > 0 && getSelectedUnmatchedCount() === preview.unmatched.filter(inv => {
                                    const nRut = normalizeRut(inv.rut);
                                    const us = unmatchedSuppliers.find(s => normalizeRut(s.rut) === nRut);
                                    return !!us && (us.resolution === 'create' || us.resolution === 'assign');
                                }).length}
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {preview.unmatched.map((inv, i) => {
                                    const nRut = normalizeRut(inv.rut);
                                    const us = unmatchedSuppliers.find(s => normalizeRut(s.rut) === nRut);
                                    const isResolvable = us && (us.resolution === 'create' || us.resolution === 'assign');
                                    
                                    return (
                                    <TableRow key={i} className={!isResolvable ? 'opacity-50 bg-muted/50' : ''}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedInvoices.has(`unmatched-${inv.invoice_number}-${i}`)}
                                                onCheckedChange={() => toggleInvoice(`unmatched-${inv.invoice_number}-${i}`)}
                                                disabled={!isResolvable}
                                            />
                                        </TableCell>
                                        <TableCell>{inv.invoice_number}</TableCell>
                                        <TableCell>
                                            <div>{inv.razonSocial}</div>
                                            <div className="text-xs text-muted-foreground">{inv.rut}</div>
                                        </TableCell>
                                        <TableCell>{inv.issueDate}</TableCell>
                                        <TableCell className="text-right">{formatCLP(inv.amount)}</TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                    </div>
                   </ScrollArea>
                </TabsContent>
                
                <TabsContent value="duplicates" className="absolute inset-0 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                              <Ban className="h-4 w-4 text-muted-foreground" />
                              Duplicados ({getSelectedDuplicatesCount()}/{preview.duplicates.length})
                            </h3>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={preview.duplicates.length > 0 && getSelectedDuplicatesCount() === preview.duplicates.length}
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {preview.duplicates.map((inv, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedInvoices.has(`duplicate-${inv.invoice_number}-${i}`)}
                                                onCheckedChange={() => toggleInvoice(`duplicate-${inv.invoice_number}-${i}`)}
                                            />
                                        </TableCell>
                                        <TableCell>{inv.invoice_number}</TableCell>
                                        <TableCell>{inv.razonSocial}</TableCell>
                                        <TableCell>{inv.issueDate}</TableCell>
                                        <TableCell className="text-right">{formatCLP(inv.amount)}</TableCell>
                                    </TableRow>
                                ))}
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
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-medium">Importando facturas...</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Esto puede tomar unos momentos. Por favor no cierres esta ventana.
            </p>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium">Importación completada</h3>
            <div className="mt-4 space-y-1">
              <p className="text-sm text-muted-foreground">
                Se importaron {importResult.imported} facturas correctamente.
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

        <DialogFooter className="mt-4">
          {step === 'preview' && (
            <div className="flex justify-between w-full items-center">
              <div className="text-sm text-muted-foreground">
                {totalToImport} seleccionadas
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetState}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} disabled={!canImport()}>
                  Importar Selección
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Simple Create Supplier Dialog */}
    <Dialog open={isCreatingSupplier} onOpenChange={setIsCreatingSupplier}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Crear Proveedor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rut" className="text-right">RUT</Label>
                    <Input id="rut" value={newSupplierData.rut} onChange={e => setNewSupplierData({...newSupplierData, rut: e.target.value})} className="col-span-3" />
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
      <DialogContent className="max-w-md">
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
