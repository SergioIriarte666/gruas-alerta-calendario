import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';
import XMLPaymentConfig from '@/components/common/XMLPaymentConfig';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, X, FileSpreadsheet, Users, Receipt, DollarSign, Calendar, Building, CalendarIcon, Banknote, CreditCard, ShieldAlert, Link2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';
import { dedupeSuppliersByIdentity, findSupplierByIdentity } from '@/utils/supplierIdentity';
import { XMLCompleteParseResult, XMLDocumentData, XMLSupplierData, XMLSupplierPaymentData } from '@/types/suppliers';
import { supabase } from '@/integrations/supabase/client';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCostCategories } from '@/hooks/useCostCategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { useSupplierPayments } from '@/hooks/useSupplierPayments';
import { useSupplierInvoiceDuplicateCheck, SupplierInvoiceDuplicateResult } from '@/hooks/useDuplicateCheck';
import { useLinkInvoiceToCost } from '@/hooks/useCosts';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { toast } from 'sonner';

// Type for matched cost
interface MatchedCost {
  id: string;
  description: string;
  amount: number;
  date: string;
  payment_date: string | null;
  supplier_name: string;
  supplier_payment_id: string | null;
  has_invoice: boolean;
}

interface XMLDocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
export const XMLDocumentUpload: React.FC<XMLDocumentUploadProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLCompleteParseResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [supplierCategoryMapping, setSupplierCategoryMapping] = useState<Record<string, string>>({});
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [createPayments, setCreatePayments] = useState(true);
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({});
  const [defaultDaysToAdd, setDefaultDaysToAdd] = useState<number>(30);
  
  // Estados para condiciones de pago (tipo Facturas)
  const [paymentTermId, setPaymentTermId] = useState<string>('none');
  const [bulkDueDate, setBulkDueDate] = useState<string>('');
  const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'pending' | 'paid'>>({});
  
  // Estados para duplicados
  const [duplicateResults, setDuplicateResults] = useState<SupplierInvoiceDuplicateResult[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  
  // Estados para matching de costos existentes
  const [matchedCosts, setMatchedCosts] = useState<Record<string, MatchedCost[]>>({});
  const [linkDecisions, setLinkDecisions] = useState<Record<string, string | 'new'>>({});
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);
  
  const {
    suppliers,
    createSupplier
  } = useSuppliers();
  const { createPayment, updatePayment } = useSupplierPayments();
  const { checkDuplicates } = useSupplierInvoiceDuplicateCheck();
  const linkInvoiceMutation = useLinkInvoiceToCost();
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();
  const { data: costCategoriesData = [] } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type === 'text/xml' || file.type === 'application/xml' || file.name.endsWith('.xml')) {
        setSelectedFile(file);
        setParseResult(null);
        setUploadProgress(0);
        setSupplierCategoryMapping({});
        setSelectedSuppliers(new Set());
        setSelectedDocuments(new Set());
      } else {
        toast.error('Por favor selecciona un archivo XML válido');
      }
    }
  }, []);
  const {
    getRootProps,
    getInputProps,
    isDragActive
  } = useDropzone({
    onDrop,
    accept: {
      'text/xml': ['.xml'],
      'application/xml': ['.xml']
    },
    multiple: false
  });
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement> | Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      onDrop([file]);
    }
  };
  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    const parser = new XMLSupplierParser();
    try {
      const result = await parser.parseXMLCompleteFile(selectedFile);
      const uniqueSuppliers = dedupeSuppliersByIdentity(result.suppliers);
      const normalizedResult = {
        ...result,
        suppliers: uniqueSuppliers,
        totalSuppliers: uniqueSuppliers.length,
        validSuppliers: uniqueSuppliers.filter(item => item.name && item.name.trim().length > 0).length,
      };
      setParseResult(normalizedResult);

      // Pre-select all valid suppliers and documents
      const validSuppliers = new Set(uniqueSuppliers.filter(s => s.name && s.rut).map(s => s.rut));
      const validDocuments = new Set(result.documents.filter(d => d.folio && d.total_amount > 0).map(d => d.folio));
      setSelectedSuppliers(validSuppliers);
      setSelectedDocuments(validDocuments);

      // Initialize category mapping
      const categoryMap: Record<string, string> = {};
      uniqueSuppliers.forEach(supplier => {
        categoryMap[supplier.rut] = supplier.category;
      });
      setSupplierCategoryMapping(categoryMap);
      
      // Initialize bulkDueDate from first document's issue_date + 30 days
      if (result.documents.length > 0 && result.documents[0].issue_date) {
        const firstIssue = safeParseDateOnly(result.documents[0].issue_date);
        setBulkDueDate(format(addDays(firstIssue, 30), 'yyyy-MM-dd'));
      } else {
        setBulkDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
      }
      
      // Initialize per-document due date overrides from XML dates + default days
      const initialDueOverrides: Record<string, string> = {};
      result.documents.forEach(doc => {
        if (doc.issue_date) {
          const issueDate = safeParseDateOnly(doc.issue_date);
          initialDueOverrides[doc.folio] = format(addDays(issueDate, defaultDaysToAdd), 'yyyy-MM-dd');
        }
      });
      setDueDateOverrides(initialDueOverrides);

      if (!result.success) {
        toast.error('Se encontraron errores en el archivo XML');
      } else {
        toast.success(`Análisis completado: ${result.totalSuppliers} proveedores, ${result.totalDocuments} documentos. Verificando duplicados...`);
        
        // Verificar duplicados de documentos
        if (result.documents.length > 0) {
          setIsCheckingDuplicates(true);
          try {
            const itemsToCheck = result.documents.map((doc, index) => ({
              folio: doc.folio,
              supplier_rut: doc.supplier_rut,
              amount: doc.total_amount
            }));
            
            const duplicates = await checkDuplicates(itemsToCheck);
            setDuplicateResults(duplicates);
            
            // Auto-deseleccionar duplicados exactos por folio
            if (duplicates.length > 0) {
              const exactDuplicates = duplicates.filter(d => d.matchType === 'exact_folio');
              if (exactDuplicates.length > 0) {
                const newSelection = new Set(validDocuments);
                exactDuplicates.forEach(d => {
                  const doc = result.documents[d.index];
                  if (doc) newSelection.delete(doc.folio);
                });
                setSelectedDocuments(newSelection);
                setShowDuplicateWarning(true);
                toast.warning(`Se detectaron ${duplicates.length} posibles duplicados. ${exactDuplicates.length} por folio fueron deseleccionados.`);
              } else {
                toast.warning(`Se detectaron ${duplicates.length} posibles duplicados. Revísalos antes de importar.`);
              }
            }
          } catch (dupError) {
            console.error('Error checking duplicates:', dupError);
          } finally {
            setIsCheckingDuplicates(false);
          }
        }
        
        // Search for matching existing costs
        if (result.documents.length > 0) {
          setIsSearchingMatches(true);
          try {
            const matches: Record<string, MatchedCost[]> = {};
            const decisions: Record<string, string | 'new'> = {};
            
            for (const doc of result.documents) {
              if (!doc.supplier_rut || !doc.total_amount) continue;
              
              const issueDate = safeParseDateOnly(doc.issue_date || format(new Date(), 'yyyy-MM-dd'));
              const dateFrom = new Date(issueDate);
              dateFrom.setDate(dateFrom.getDate() - 7);
              const dateTo = new Date(issueDate);
              dateTo.setDate(dateTo.getDate() + 7);
              
              const { data, error } = await supabase.rpc('find_matching_costs_for_invoice', {
                p_supplier_rut: doc.supplier_rut,
                p_amount: doc.total_amount,
                p_date_from: format(dateFrom, 'yyyy-MM-dd'),
                p_date_to: format(dateTo, 'yyyy-MM-dd'),
              });
              
              if (!error && data && data.length > 0) {
                matches[doc.folio] = data as MatchedCost[];
                // Auto-select exact match (same amount)
                const exactMatch = data.find((m: any) => Math.abs(m.amount - doc.total_amount) < 1);
                decisions[doc.folio] = exactMatch ? (exactMatch as any).id : 'new';
              }
            }
            
            setMatchedCosts(matches);
            setLinkDecisions(decisions);
            
            const matchCount = Object.keys(matches).length;
            if (matchCount > 0) {
              toast.info(`🔗 Se encontraron ${matchCount} costos existentes que coinciden con documentos del XML`);
            }
          } catch (matchError) {
            console.error('Error searching matches:', matchError);
          } finally {
            setIsSearchingMatches(false);
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing XML:', error);
      toast.error('Error al analizar el archivo XML');
    } finally {
      setIsAnalyzing(false);
    }
  };
  const handleUploadData = async () => {
    if (!parseResult) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const totalItems = selectedSuppliers.size + (createPayments ? selectedDocuments.size : 0);
      let processed = 0;

      // Create suppliers first
      const createdSupplierMap = new Map<string, string>();
      for (const supplier of parseResult.suppliers) {
        if (!selectedSuppliers.has(supplier.rut)) continue;
        try {
          // Check if supplier already exists
          const existingSupplier = findSupplierByIdentity(suppliers, supplier);
          if (!existingSupplier) {
            await new Promise<void>((resolve, reject) => {
              createSupplier({
                ...supplier,
                category: supplierCategoryMapping[supplier.rut] || supplier.category
              }, {
                onSuccess: newSupplier => {
                  createdSupplierMap.set(supplier.rut, newSupplier.id);
                  resolve();
                },
                onError: reject
              });
            });
          } else {
            createdSupplierMap.set(supplier.rut, existingSupplier.id);
          }
          processed++;
          setUploadProgress(processed / totalItems * 100);
        } catch (error) {
          console.error(`Error creating supplier ${supplier.name}:`, error);
        }
      }

      // Create payments if requested
      if (createPayments) {
        const parser = new XMLSupplierParser();
        const paymentsData = parser.convertDocumentsToPayments(
          parseResult.documents.filter(d => selectedDocuments.has(d.folio)), 
          parseResult.suppliers,
          dueDateOverrides
        );


        let exactFolioUpdated = 0;
        let exactFolioSkipped = 0;
        let linkedCount = 0;

        for (const paymentData of paymentsData) {
          try {
            const supplierId = createdSupplierMap.get(paymentData.supplier_rut);
            if (!supplierId) continue;
            
            // Determinar status y fecha de pago
            const docFolio = paymentData.reference_number || '';
            const status = statusOverrides[docFolio] || 'pending';
            const paidDate = status === 'paid' 
              ? paidDateOverrides[docFolio] || format(new Date(), 'yyyy-MM-dd')
              : undefined;

            // Pre-check: skip if supplier_payment with same folio already exists
            if (docFolio) {
              const { data: existingPayment } = await supabase
                .from('supplier_payments')
                .select('id')
                .eq('supplier_id', supplierId)
                .eq('reference_number', docFolio)
                .maybeSingle();
              
              if (existingPayment) {
                console.log(`Folio ${docFolio} ya existe en supplier_payments, omitiendo`);
                toast.info(`Folio ${docFolio} ya registrado, omitido`);
                processed++;
                setUploadProgress(processed / totalItems * 100);
                continue;
              }
            }

            // Check if user chose to link to existing cost
            const linkCostId = linkDecisions[docFolio];
            if (linkCostId && linkCostId !== 'new') {
              // Find the original document data
              const originalDoc = parseResult.documents.find(d => d.folio === docFolio);
              if (originalDoc) {
                await linkInvoiceMutation.mutateAsync({
                  costId: linkCostId,
                  supplierId,
                  invoiceData: {
                    folio: docFolio,
                    issueDate: originalDoc.issue_date,
                    dueDate: originalDoc.due_date || paymentData.due_date,
                    amount: originalDoc.total_amount,
                    netAmount: originalDoc.net_amount,
                    taxAmount: originalDoc.vat_amount,
                    description: originalDoc.description,
                    currency: originalDoc.currency,
                    paidDate: paidDate,
                    status: status as 'pending' | 'paid',
                  },
                });
                linkedCount++;
              }
              processed++;
              setUploadProgress(processed / totalItems * 100);
              continue;
            }

            const duplicateInfo = docFolio ? getDuplicateInfoByFolio(docFolio) : undefined;

            // If the folio already exists (exact match), never create a new row.
            // If user is importing as paid, update the existing payment to paid.
            if (duplicateInfo?.matchType === 'exact_folio' && duplicateInfo.existingPayment?.id) {
              if (status === 'paid') {
                await new Promise<void>((resolve, reject) => {
                  updatePayment({
                    id: duplicateInfo.existingPayment!.id,
                    data: {
                      status: 'paid',
                      paid_date: paidDate,
                      paid_amount: paymentData.amount,
                    }
                  }, {
                    onSuccess: () => resolve(),
                    onError: reject
                  });
                });
                exactFolioUpdated++;
              } else {
                exactFolioSkipped++;
              }

              processed++;
              setUploadProgress(processed / totalItems * 100);
              continue;
            }
            
            const createdPayment = await new Promise<any>((resolve, reject) => {
              createPayment({
                supplier_id: supplierId,
                amount: paymentData.amount,
                due_date: paymentData.due_date,
                description: paymentData.description,
                category: paymentData.category,
                reference_number: paymentData.reference_number,
                notes: paymentData.notes,
                status: status,
                paid_date: paidDate,
                paid_amount: status === 'paid' ? paymentData.amount : undefined
              }, {
                onSuccess: (data) => resolve(data),
                onError: reject
              });
            });

            // Cost creation is handled automatically by the DB trigger
            // create_cost_from_supplier_payment on supplier_payments INSERT
            processed++;
            setUploadProgress(processed / totalItems * 100);
          } catch (error) {
            console.error(`Error creating payment:`, error);
          }
        }

        if (exactFolioUpdated > 0 || exactFolioSkipped > 0) {
          toast.message(`Duplicados por folio: ${exactFolioUpdated} actualizado(s), ${exactFolioSkipped} omitido(s)`);
        }
        if (linkedCount > 0) {
          toast.success(`🔗 ${linkedCount} factura(s) vinculada(s) a costos existentes`);
        }
      }
      toast.success(`Importación completada: ${selectedSuppliers.size} proveedores${createPayments ? ` y ${selectedDocuments.size} pagos` : ''} procesados`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error uploading data:', error);
      toast.error('Error durante la importación');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  const handleCategoryChange = (supplierRut: string, category: string) => {
    setSupplierCategoryMapping(prev => ({
      ...prev,
      [supplierRut]: category
    }));
  };
  const toggleSupplierSelection = (supplierRut: string) => {
    setSelectedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supplierRut)) {
        newSet.delete(supplierRut);
      } else {
        newSet.add(supplierRut);
      }
      return newSet;
    });
  };
  const toggleDocumentSelection = (documentFolio: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentFolio)) {
        newSet.delete(documentFolio);
      } else {
        newSet.add(documentFolio);
      }
      return newSet;
    });
  };
  const reset = () => {
    setSelectedFile(null);
    setParseResult(null);
    setUploadProgress(0);
    setSupplierCategoryMapping({});
    setSelectedSuppliers(new Set());
    setSelectedDocuments(new Set());
    setCreatePayments(true);
    setDueDateOverrides({});
    setDefaultDaysToAdd(30);
    setPaymentTermId('none');
    setBulkDueDate('');
    setPaidDateOverrides({});
    setStatusOverrides({});
    setDuplicateResults([]);
    setShowDuplicateWarning(false);
    setMatchedCosts({});
    setLinkDecisions({});
  };
  
  // Helper para obtener info de duplicado por folio
  const getDuplicateInfoByFolio = (folio: string): SupplierInvoiceDuplicateResult | undefined => {
    return duplicateResults.find(d => {
      const doc = parseResult?.documents[d.index];
      return doc?.folio === folio;
    });
  };

  const handleDueDateChange = (documentFolio: string, date: Date | undefined) => {
    if (date) {
      setDueDateOverrides(prev => ({
        ...prev,
        [documentFolio]: format(date, 'yyyy-MM-dd')
      }));
    }
  };

  const applyDefaultDaysToAll = () => {
    if (!parseResult) return;
    const term = paymentTermId !== 'none' ? paymentTerms.find(t => t.id === paymentTermId) : null;
    const daysToAdd = term ? term.days : defaultDaysToAdd;
    const newOverrides: Record<string, string> = {};
    parseResult.documents.forEach(doc => {
      if (selectedDocuments.has(doc.folio) && doc.issue_date) {
        const issueDate = safeParseDateOnly(doc.issue_date);
        newOverrides[doc.folio] = format(addDays(issueDate, daysToAdd), 'yyyy-MM-dd');
      }
    });
    setDueDateOverrides(newOverrides);
    toast.success(`Fechas de vencimiento actualizadas a ${daysToAdd} días desde emisión`);
  };
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card border suppliers-scope">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Documentos XML
          </DialogTitle>
          
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Area */}
          {!selectedFile && <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted hover:border-border'}`}>
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo XML aquí'}
              </h3>
              <p className="text-muted-foreground mb-4">
                o haz clic para seleccionar un archivo
              </p>
              <Button variant="outline" onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xml';
            input.onchange = handleFileSelect;
            input.click();
          }}>
                Seleccionar Archivo
              </Button>
            </div>}

          {/* File Info */}
          {selectedFile && !parseResult && <Card className="bg-card border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-foreground font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleAnalyzeFile} disabled={isAnalyzing} variant="default">
                      {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                      Analizar XML
                    </Button>
                    <Button variant="outline" onClick={reset}>
                      <X className="h-4 w-4 mr-2" />
                      Quitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>}

          {/* Upload Progress */}
          {isUploading && <Card className="bg-card border">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-foreground">
                    <span>Subiendo datos...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>}

          {/* Parse Results */}
          {parseResult && <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Proveedores</p>
                        <p className="text-xl font-bold text-foreground">
                          {parseResult.validSuppliers}/{parseResult.totalSuppliers}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Documentos</p>
                        <p className="text-xl font-bold text-foreground">
                          {parseResult.validDocuments}/{parseResult.totalDocuments}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="text-sm text-muted-foreground">Errores</p>
                        <p className="text-xl font-bold text-foreground">
                          {parseResult.errors.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Montos</p>
                        <p className="text-xl font-bold text-foreground">
                          ${parseResult.documents.filter(d => selectedDocuments.has(d.folio)).reduce((sum, d) => sum + d.total_amount, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Options */}
              <Card className="bg-card border">
                <CardHeader>
                  <CardTitle className="text-foreground">Opciones de Importación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="create-payments" checked={createPayments} onCheckedChange={checked => setCreatePayments(checked === true)} />
                    <label htmlFor="create-payments" className="text-foreground">
                      Crear pagos automáticamente desde los documentos
                    </label>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Duplicate Warning Banner */}
              {duplicateResults.length > 0 && showDuplicateWarning && (
                <Alert className="border-amber-300 bg-amber-50">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>⚠️ Se detectaron {duplicateResults.length} posibles duplicados de facturas.</strong>
                    <span className="ml-2">
                      {duplicateResults.filter(d => d.matchType === 'exact_folio').length > 0 && (
                        <Badge variant="destructive" className="mr-2">
                          {duplicateResults.filter(d => d.matchType === 'exact_folio').length} por folio
                        </Badge>
                      )}
                      {duplicateResults.filter(d => d.matchType === 'similar').length > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {duplicateResults.filter(d => d.matchType === 'similar').length} similares
                        </Badge>
                      )}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="ml-4 text-amber-700 hover:text-amber-900"
                      onClick={() => setShowDuplicateWarning(false)}
                    >
                      Ocultar
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Checking duplicates indicator */}
              {isCheckingDuplicates && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700">Verificando duplicados en la base de datos...</span>
                </div>
              )}

              {/* Searching cost matches indicator */}
              {isSearchingMatches && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">Buscando costos existentes que coincidan...</span>
                </div>
              )}

              {/* Cost matching summary */}
              {Object.keys(matchedCosts).length > 0 && (
                <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950/20">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <strong>🔗 {Object.keys(matchedCosts).length} documento(s)</strong> coinciden con costos ya registrados.
                    Puedes vincular la factura al costo existente o crear un pago nuevo.
                  </AlertDescription>
                </Alert>
              )}

              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && <div className="space-y-2">
                  {parseResult.errors.length > 0 && <Alert className="border-destructive bg-destructive/10">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-destructive">
                        <strong>Errores encontrados:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.errors.slice(0, 5).map((error, index) => <li key={index} className="text-sm">{error}</li>)}
                          {parseResult.errors.length > 5 && <li className="text-sm">... y {parseResult.errors.length - 5} errores más</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>}

                  {parseResult.warnings.length > 0 && <Alert className="border-yellow-600 bg-yellow-600/10">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-600">
                        <strong>Advertencias:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.warnings.slice(0, 3).map((warning, index) => <li key={index} className="text-sm">{warning}</li>)}
                          {parseResult.warnings.length > 3 && <li className="text-sm">... y {parseResult.warnings.length - 3} advertencias más</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>}
                </div>}

              {/* Suppliers Preview */}
              {parseResult.suppliers.length > 0 && <Card className="bg-card border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Proveedores Encontrados ({parseResult.suppliers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {parseResult.suppliers.map((supplier, index) => <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                          <div className="flex items-center space-x-3">
                            <Checkbox checked={selectedSuppliers.has(supplier.rut)} onCheckedChange={checked => {
                      if (checked === true) {
                        toggleSupplierSelection(supplier.rut);
                      } else if (checked === false) {
                        toggleSupplierSelection(supplier.rut);
                      }
                    }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground font-medium truncate">{supplier.name}</p>
                              <p className="text-sm text-muted-foreground">{supplier.rut}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Select value={supplierCategoryMapping[supplier.rut] || supplier.category} onValueChange={value => handleCategoryChange(supplier.rut, value)}>
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeCategories?.map(category => <SelectItem key={category.id} value={category.name}>
                                    {getCategoryLabel(activeCategories, category.name)}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>)}
                    </div>
                  </CardContent>
                </Card>}

              {/* Documents Preview */}
              {parseResult.documents.length > 0 && <Card className="bg-card border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Documentos Encontrados ({parseResult.documents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {parseResult.documents.map((document, index) => {
                        const parser = new XMLSupplierParser();
                        const defaultDueDate = dueDateOverrides[document.folio] || 
                          document.due_date || 
                          (() => {
                            const date = safeParseDateOnly(document.issue_date || format(new Date(), 'yyyy-MM-dd'));
                            date.setDate(date.getDate() + defaultDaysToAdd);
                            return format(date, 'yyyy-MM-dd');
                          })();
                        const hasCustomDate = !!dueDateOverrides[document.folio];
                        
                        // Obtener info de duplicado
                        const duplicateInfo = getDuplicateInfoByFolio(document.folio);
                        const isDuplicate = !!duplicateInfo;
                        
                        // Obtener costos coincidentes
                        const costsForDoc = matchedCosts[document.folio] || [];
                        const hasMatches = costsForDoc.length > 0;
                        const currentDecision = linkDecisions[document.folio] || 'new';
                        
                        return (
                          <div key={index} className={cn(
                            "flex flex-col p-3 rounded gap-2",
                            hasMatches && currentDecision !== 'new'
                              ? "bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                              : isDuplicate && duplicateInfo.matchType === 'exact_folio'
                              ? "bg-red-50 border border-red-200"
                              : isDuplicate && duplicateInfo.matchType === 'similar'
                              ? "bg-yellow-50 border border-yellow-200"
                              : "bg-muted/50"
                          )}>
                            {/* Matched cost selector */}
                            {hasMatches && (
                              <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                                <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium">🔗 Costo encontrado:</span>
                                <Select 
                                  value={currentDecision} 
                                  onValueChange={(val) => setLinkDecisions(prev => ({ ...prev, [document.folio]: val }))}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1 min-w-[200px] bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new">➕ Crear nuevo pago</SelectItem>
                                    {costsForDoc.map(cost => (
                                      <SelectItem key={cost.id} value={cost.id}>
                                        🔗 {cost.description} — ${Number(cost.amount).toLocaleString('es-CL')} — {cost.date}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {/* Duplicate warning */}
                            {isDuplicate && duplicateInfo.existingPayment && (
                              <div className={cn(
                                "text-xs px-2 py-1 rounded",
                                duplicateInfo.matchType === 'exact_folio' ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                              )}>
                                <strong>
                                  {duplicateInfo.matchType === 'exact_folio' ? '⚠️ Folio ya registrado:' : '🔍 Similar:'}
                                </strong>
                                {' '}{duplicateInfo.existingPayment.supplier_name} - ${duplicateInfo.existingPayment.amount.toLocaleString('es-CL')}
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <Checkbox 
                                checked={selectedDocuments.has(document.folio)} 
                                onCheckedChange={checked => {
                                  if (checked === true) {
                                    toggleDocumentSelection(document.folio);
                                  } else if (checked === false) {
                                    toggleDocumentSelection(document.folio);
                                  }
                                }} 
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-foreground font-medium truncate">{document.description}</p>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground flex-wrap">
                                  <span>Folio: {document.folio}</span>
                                  <span>Total: ${document.total_amount.toLocaleString()}</span>
                                  {document.issue_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      Emisión: {document.issue_date}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                              <Select
                                value={paymentTermId}
                                onValueChange={(id) => {
                                  setPaymentTermId(id);
                                  if (id !== 'none') {
                                    const term = paymentTerms.find(t => t.id === id);
                                    if (term && document.issue_date) {
                                      const issueDate = safeParseDateOnly(document.issue_date);
                                      const newDate = format(addDays(issueDate, term.days), 'yyyy-MM-dd');
                                      setDueDateOverrides(prev => ({...prev, [document.folio]: newDate}));
                                    }
                                  }
                                }}
                                disabled={loadingTerms}
                              >
                                <SelectTrigger className="min-w-[160px]" >
                                  <SelectValue placeholder={loadingTerms ? 'Cargando...' : 'Condición'} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Manual</SelectItem>
                                  {paymentTerms.map((term) => (
                                    <SelectItem key={term.id} value={term.id}>
                                      {term.name} ({term.days}d)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "justify-start text-left font-normal min-w-[180px]",
                                      !defaultDueDate && "text-muted-foreground"
                                    )}
                                    size="sm"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {defaultDueDate ? (
                                      <span className="flex items-center gap-2">
                                        {format(safeParseDateOnly(defaultDueDate), 'dd/MM/yyyy')}
                                        {hasCustomDate && (
                                          <Badge variant="secondary" className="text-xs">
                                            Personalizada
                                          </Badge>
                                        )}
                                      </span>
                                    ) : (
                                      <span>Seleccionar fecha</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <CalendarComponent
                                    mode="single"
                                    selected={defaultDueDate ? safeParseDateOnly(defaultDueDate) : undefined}
                                    onSelect={(date) => handleDueDateChange(document.folio, date)}
                                    disabled={(date) => {
                                      if (!document.issue_date) return false;
                                      return date < safeParseDateOnly(document.issue_date);
                                    }}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                  />
                                </PopoverContent>
                              </Popover>
                              
                              <Badge variant="outline" className="whitespace-nowrap">
                                {document.document_type}
                              </Badge>
                            </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>}

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={reset} disabled={isUploading}>
                  Cancelar
                </Button>
                <Button onClick={handleUploadData} disabled={isUploading || selectedSuppliers.size === 0} variant="default">
                  {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Importar {selectedSuppliers.size} Proveedores
                  {createPayments && selectedDocuments.size > 0 && ` y ${selectedDocuments.size} Pagos`}
                </Button>
              </div>
            </div>}
        </div>
      </DialogContent>
    </Dialog>;
};