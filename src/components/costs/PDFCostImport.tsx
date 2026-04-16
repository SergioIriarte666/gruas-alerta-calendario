import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { format, addDays } from 'date-fns';
import { Loader2, Upload, FileText, X, Sparkles, AlertCircle, CheckCircle, FileScan, Building, Receipt, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

import { supabase } from '@/integrations/supabase/client';
import { safeParseDateOnly } from '@/utils/timezoneUtils';

import { useAddCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { useCostDuplicateCheck } from '@/hooks/useDuplicateCheck';
import { usePDFCostExtraction, ExtractedInvoiceData } from '@/hooks/costs/usePDFCostExtraction';

interface PDFCostImportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

interface ReviewState {
  vendorName: string;
  vendorRut: string;
  documentType: string;
  documentNumber: string;
  date: string;
  total: number;
  neto: number;
  iva: number;
  paymentMethod: string;
  notes: string;
  description: string;
  categoryId: string;
  subcategory: string;
  paymentCondition: 'none' | 'credit' | string; // 'none' | term.id
  dueDate: string;
}

const cleanRut = (rut: string) =>
  (rut || '').toString().trim().replace(/\./g, '').replace(/\s+/g, '').toUpperCase();

const findSupplierByRutOrName = async (rut: string, name: string): Promise<string | null> => {
  const cleaned = cleanRut(rut);
  if (cleaned) {
    const { data } = await (supabase as any)
      .from('inventory_suppliers')
      .select('id')
      .eq('rut', cleaned)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (name && name.trim()) {
    const { data } = await (supabase as any)
      .from('inventory_suppliers')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
};

const ensureSupplier = async (rut: string, name: string, userId: string | null): Promise<string> => {
  const existing = await findSupplierByRutOrName(rut, name);
  if (existing) return existing;
  const { data, error } = await (supabase as any)
    .from('inventory_suppliers')
    .insert([{
      name: name?.trim() || 'Proveedor',
      rut: cleanRut(rut) || null,
      category: 'otros',
      is_active: true,
      created_by: userId,
    }])
    .select('id')
    .single();
  if (error || !data?.id) throw error || new Error('No se pudo crear el proveedor');
  return data.id;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const PDFCostImport: React.FC<PDFCostImportProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInvoiceData | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { extractFromPDF, isExtracting } = usePDFCostExtraction();
  const { mutate: addCost } = useAddCost();
  const { data: categories = [] } = useCostCategories();
  const { subcategories } = useCostSubcategories(review?.categoryId || '');
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();
  const { checkDuplicates } = useCostDuplicateCheck();

  const reset = useCallback(() => {
    setFile(null);
    setExtracted(null);
    setReview(null);
    setDuplicateWarning(null);
    setIsSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isExtracting || isSaving) return;
    reset();
    onClose();
  }, [isExtracting, isSaving, reset, onClose]);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecciona un archivo PDF');
      return;
    }
    setFile(f);
    setExtracted(null);
    setReview(null);
    setDuplicateWarning(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: isExtracting || isSaving,
  });

  const handleExtract = useCallback(async () => {
    if (!file) return;
    try {
      const data = await extractFromPDF(file);
      setExtracted(data);
      const today = format(new Date(), 'yyyy-MM-dd');
      const date = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : today;
      const total = Number(data.totals?.total ?? 0) || 0;
      const neto = Number(data.totals?.neto ?? 0) || 0;
      const iva = Number(data.totals?.iva ?? 0) || 0;

      const docLabel = (data.documentType || 'Factura').trim();
      const description = data.documentNumber
        ? `${docLabel} ${data.documentNumber}${data.vendorName ? ` - ${data.vendorName}` : ''}`
        : data.vendorName ? `${docLabel} - ${data.vendorName}` : docLabel;

      const initialReview: ReviewState = {
        vendorName: data.vendorName || '',
        vendorRut: cleanRut(data.vendorRut || ''),
        documentType: docLabel,
        documentNumber: data.documentNumber || '',
        date,
        total,
        neto,
        iva,
        paymentMethod: data.paymentMethod || '',
        notes: data.notes || '',
        description,
        categoryId: '',
        subcategory: '',
        paymentCondition: 'none',
        dueDate: date,
      };
      setReview(initialReview);

      // Heuristic duplicate check
      try {
        const dup = await checkDuplicates([{
          date,
          amount: total,
          description,
          folio: data.documentNumber || undefined,
        }]);
        if (dup.length > 0) {
          const m = dup[0];
          const label = m.matchType === 'exact' ? 'EXACTO' : m.matchType === 'folio' ? 'mismo folio' : 'similar';
          setDuplicateWarning(
            `Posible duplicado (${label}): ${m.existingCost?.description || ''} — $${Number(m.existingCost?.amount || 0).toLocaleString('es-CL')} (${m.existingCost?.date || ''})`
          );
        }
      } catch (e) {
        console.warn('[PDFCostImport] duplicate check failed', e);
      }

      toast.success('Datos extraídos. Revísalos antes de guardar.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al procesar el PDF';
      toast.error(msg);
    }
  }, [file, extractFromPDF, checkDuplicates]);

  // Recompute due date when payment condition changes
  useEffect(() => {
    if (!review) return;
    const cond = review.paymentCondition;
    if (cond === 'none') {
      if (review.dueDate !== review.date) setReview({ ...review, dueDate: review.date });
      return;
    }
    if (cond === 'credit') return; // user-selected manual date
    const term = paymentTerms.find(t => t.id === cond);
    if (term && review.date) {
      const newDue = format(addDays(safeParseDateOnly(review.date), term.days), 'yyyy-MM-dd');
      if (newDue !== review.dueDate) setReview({ ...review, dueDate: newDue });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review?.paymentCondition, review?.date, paymentTerms]);

  const updateReview = <K extends keyof ReviewState>(key: K, value: ReviewState[K]) => {
    setReview(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const canSave = useMemo(() => {
    if (!review) return false;
    return Boolean(review.categoryId && review.description.trim() && review.total > 0 && review.date);
  }, [review]);

  const handleSave = async () => {
    if (!review || !canSave) {
      toast.error('Completa categoría, descripción, fecha y monto antes de guardar');
      return;
    }
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      // Resolve supplier (only if we have something to identify)
      let supplierId: string | null = null;
      if (review.vendorRut.trim() || review.vendorName.trim()) {
        try {
          supplierId = await ensureSupplier(review.vendorRut, review.vendorName, userId);
        } catch (e) {
          console.warn('[PDFCostImport] supplier ensure failed', e);
        }
      }

      const cond = review.paymentCondition;
      const isCash = cond === 'none';
      const paymentDate = isCash ? review.date : null;

      const notesParts = [
        review.vendorName ? `Proveedor: ${review.vendorName}` : '',
        review.documentNumber ? `${review.documentType || 'Documento'}: ${review.documentNumber}` : '',
        review.vendorRut ? `RUT: ${review.vendorRut}` : '',
        review.paymentMethod ? `Medio de pago: ${review.paymentMethod}` : '',
        review.notes?.trim() ? review.notes.trim() : '',
        '— Importado desde PDF (extracción IA)',
      ].filter(Boolean).join(' | ');

      const costData: any = {
        date: review.date,
        description: review.description.trim(),
        amount: review.total,
        category_id: review.categoryId,
        subcategory: review.subcategory || null,
        notes: notesParts || null,
        service_folio: review.documentNumber || null,
        document_number: review.documentNumber || null,
        document_type: review.documentType || null,
        payment_date: paymentDate,
        supplier_id: supplierId,
      };

      await new Promise<void>((resolve, reject) => {
        addCost(costData, {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        });
      });

      toast.success('Factura PDF importada como costo');
      onSuccess?.(1);
      reset();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar el costo';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="w-[min(99vw,1100px)] max-w-[1100px] max-h-[95vh] overflow-y-auto border-border/60 bg-gradient-to-b from-background to-muted/20 p-0 shadow-2xl">
        <DialogHeader className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4 dark:from-slate-950 dark:via-background dark:to-slate-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="rounded-lg bg-violet-600/10 p-2 text-violet-600">
                  <FileScan className="h-5 w-5" />
                </span>
                Importar Factura desde PDF
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Extrae automáticamente proveedor, folio, fecha y montos desde el PDF de la factura usando IA. Revisa y confirma antes de crear el costo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {file ? (
                <Badge variant="outline" className="bg-background/70 px-3 py-1 text-xs">
                  Archivo: {file.name}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-background/70 px-3 py-1 text-xs">
                  Esperando PDF
                </Badge>
              )}
              {extracted && (
                <Badge variant="secondary" className="px-3 py-1 text-xs bg-violet-600/10 text-violet-700 dark:text-violet-300">
                  Datos extraídos
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6 pt-4">
          {/* Upload */}
          {!file && (
            <div
              {...getRootProps()}
              className={cn(
                'relative overflow-hidden border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                isDragActive
                  ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                  : 'border-border/80 bg-background/80 hover:border-violet-500/60 hover:bg-violet-500/5'
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(263_70%_60%/0.08),_transparent_45%)]" />
              <input {...getInputProps()} />
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600 shadow-sm">
                <Upload className="h-8 w-8" />
              </div>
              <p className="relative font-semibold text-base">
                {isDragActive ? 'Suelta el PDF aquí' : 'Arrastra una factura PDF o haz clic para seleccionarla'}
              </p>
              <p className="relative mt-1 text-sm text-muted-foreground">Solo se procesa la primera página</p>
              <div className="relative mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="secondary" className="bg-background/80">Extracción IA</Badge>
                <Badge variant="secondary" className="bg-background/80">Detección de duplicados</Badge>
                <Badge variant="secondary" className="bg-background/80">Trazabilidad de proveedor</Badge>
              </div>
            </div>
          )}

          {/* File selected, awaiting extraction */}
          {file && !extracted && (
            <Card className="bg-card border">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-violet-600" />
                    <div>
                      <p className="text-foreground font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleExtract}
                      disabled={isExtracting}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Extrayendo con IA…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Extraer datos
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={reset} disabled={isExtracting}>
                      <X className="h-4 w-4 mr-2" /> Quitar
                    </Button>
                  </div>
                </div>
                {isExtracting && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Convirtiendo la primera página a imagen y enviándola al modelo de visión. Esto puede tardar 5-15 segundos.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Review form */}
          {review && (
            <div className="space-y-4">
              {duplicateWarning && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>⚠ Posible duplicado.</strong> {duplicateWarning}
                  </AlertDescription>
                </Alert>
              )}

              {/* Supplier section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="w-4 h-4 text-violet-600" /> Proveedor (emisor)
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Razón social</Label>
                    <Input
                      value={review.vendorName}
                      onChange={(e) => updateReview('vendorName', e.target.value)}
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">RUT</Label>
                    <Input
                      value={review.vendorRut}
                      onChange={(e) => updateReview('vendorRut', e.target.value.toUpperCase())}
                      placeholder="76123456-7"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Document section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-violet-600" /> Documento
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Input
                      value={review.documentType}
                      onChange={(e) => updateReview('documentType', e.target.value)}
                      placeholder="Factura"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">N° / Folio</Label>
                    <Input
                      value={review.documentNumber}
                      onChange={(e) => updateReview('documentNumber', e.target.value)}
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha emisión</Label>
                    <Input
                      type="date"
                      value={review.date}
                      onChange={(e) => updateReview('date', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Amounts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-violet-600" /> Montos
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Neto</Label>
                    <Input
                      type="number"
                      value={review.neto || ''}
                      onChange={(e) => updateReview('neto', Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">IVA</Label>
                    <Input
                      type="number"
                      value={review.iva || ''}
                      onChange={(e) => updateReview('iva', Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Total *</Label>
                    <Input
                      type="number"
                      value={review.total || ''}
                      onChange={(e) => updateReview('total', Number(e.target.value) || 0)}
                      placeholder="0"
                      className={review.total > 0 ? '' : 'border-destructive'}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Classification + payment condition */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Clasificación y pago</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Categoría *</Label>
                    <Select value={review.categoryId} onValueChange={(v) => { updateReview('categoryId', v); updateReview('subcategory', ''); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Subcategoría</Label>
                    <Select
                      value={review.subcategory}
                      onValueChange={(v) => updateReview('subcategory', v)}
                      disabled={!review.categoryId || subcategories.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={subcategories.length === 0 ? 'Sin subcategorías' : 'Selecciona...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories.map((s) => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Condición de pago</Label>
                    <Select
                      value={review.paymentCondition}
                      onValueChange={(v) => updateReview('paymentCondition', v as ReviewState['paymentCondition'])}
                      disabled={loadingTerms}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona condición" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Contado (pagado a la fecha)</SelectItem>
                        <SelectItem value="credit">Crédito (fecha manual)</SelectItem>
                        {paymentTerms.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name} ({t.days} días)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Fecha de vencimiento / pago</Label>
                    <Input
                      type="date"
                      value={review.dueDate}
                      onChange={(e) => updateReview('dueDate', e.target.value)}
                      disabled={review.paymentCondition !== 'credit' && review.paymentCondition === 'none'}
                    />
                    {review.paymentCondition === 'none' && (
                      <p className="text-[11px] text-muted-foreground mt-1">Contado: el costo queda marcado como pagado en la fecha de emisión.</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs">Descripción / glosa *</Label>
                    <Textarea
                      value={review.description}
                      onChange={(e) => updateReview('description', e.target.value)}
                      rows={2}
                      placeholder="Descripción que aparecerá en el costo"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs">Notas adicionales</Label>
                    <Textarea
                      value={review.notes}
                      onChange={(e) => updateReview('notes', e.target.value)}
                      rows={2}
                      placeholder="Notas internas"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Items detected (read-only preview) */}
              {extracted && extracted.items && extracted.items.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Ítems detectados ({extracted.items.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 text-muted-foreground">
                          <tr>
                            <th className="text-left p-2">Descripción</th>
                            <th className="text-right p-2">Cant.</th>
                            <th className="text-right p-2">P. Unit.</th>
                            <th className="text-right p-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extracted.items.map((it, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{it.description || '—'}</td>
                              <td className="p-2 text-right">{it.quantity ?? ''}</td>
                              <td className="p-2 text-right">{typeof it.unitPrice === 'number' ? `$${it.unitPrice.toLocaleString('es-CL')}` : ''}</td>
                              <td className="p-2 text-right">{typeof it.total === 'number' ? `$${it.total.toLocaleString('es-CL')}` : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Los ítems son referenciales — el costo se crea como un único registro consolidado.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Action bar */}
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
                <Button variant="outline" onClick={reset} disabled={isSaving}>
                  <X className="h-4 w-4 mr-2" /> Empezar de nuevo
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!canSave || isSaving}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando…
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" /> Crear costo
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFCostImport;
