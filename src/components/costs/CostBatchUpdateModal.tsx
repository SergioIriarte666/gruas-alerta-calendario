import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cost } from '@/types/costs';
import { CostBatchUpdateData, MarkCostsPaidBatchResult, useMarkCostsPaidBatch, useUpdateCostsBatch } from '@/hooks/useUpdateCostsBatch';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useInventorySuppliers } from '@/hooks/useInventory';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { SupplierCombobox } from '@/components/costs/form/SupplierSelector';
import { BarChart3, Calendar, CheckCircle, Download, Tag, Building2, User, FileText, Plus, Loader2 } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';
import * as XLSX from 'xlsx';
import { createLogger } from "@/lib/logger";

const logger = createLogger("CostBatchUpdateModal");
interface CostBatchUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCosts: Cost[];
  mode?: 'update' | 'markPaid';
}

export const CostBatchUpdateModal = ({
  open,
  onOpenChange,
  selectedCosts,
  mode = 'update',
}: CostBatchUpdateModalProps) => {
  const isMarkPaidMode = mode === 'markPaid';
  const { mutateAsync: updateBatch, isPending: isUpdating } = useUpdateCostsBatch();
  const { mutateAsync: markPaidBatch, isPending: isMarkingPaid } = useMarkCostsPaidBatch();
  const { data: categories = [] } = useCostCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: suppliers = [] } = useInventorySuppliers();
  const batchProgress = useBatchProgress();

  const supplierOptions = useMemo(() => suppliers.map((supplier) => ({
    ...supplier,
    rut: supplier.rut ?? null,
    email: supplier.email ?? null,
    phone: supplier.phone ?? null,
    address: supplier.address ?? null,
    contact_person: supplier.contact_person ?? null,
    category: '',
    payment_terms: supplier.payment_terms ?? null,
    delivery_time_days: supplier.delivery_time_days ?? null,
    created_by: supplier.created_by ?? null,
  })), [suppliers]);

  // Estados para los toggles de cada campo
  const [enableCategory, setEnableCategory] = useState(false);
  const [enableSubcategory, setEnableSubcategory] = useState(false);
  const [enableDate, setEnableDate] = useState(false);
  const [enablePaymentDate, setEnablePaymentDate] = useState(false);
  const [enableCostCenter, setEnableCostCenter] = useState(false);
  const [enableSupplier, setEnableSupplier] = useState(false);
  const [enableNotes, setEnableNotes] = useState(false);

  // Estados para los valores
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [costCenterId, setCostCenterId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [appendNotes, setAppendNotes] = useState(false);

  const [markPaidPaymentDate, setMarkPaidPaymentDate] = useState<string>(getCurrentChileDateString());
  const [markPaidUseCostDate, setMarkPaidUseCostDate] = useState<boolean>(true);
  const [markPaidStage, setMarkPaidStage] = useState<'confirm' | 'done'>('confirm');
  const [markPaidResult, setMarkPaidResult] = useState<MarkCostsPaidBatchResult | null>(null);
  const [markPaidError, setMarkPaidError] = useState<string>('');

  // Estado para crear nueva subcategoría
  const [newSubcategoryName, setNewSubcategoryName] = useState('');

  // Hook para obtener subcategorías basadas en la categoría seleccionada
  const { 
    subcategories: availableSubcategories = [],
    createSubcategory,
    isCreating: isCreatingSubcategory 
  } = useCostSubcategories(
    enableCategory && categoryId ? categoryId : undefined
  );

  // Limpiar subcategoría cuando cambia la categoría
  React.useEffect(() => {
    if (enableCategory && categoryId) {
      setSubcategory('');
      setNewSubcategoryName('');
    }
  }, [categoryId, enableCategory]);

  React.useEffect(() => {
    if (!enableCategory || !categoryId) return;
    if (!enableCostCenter) return;
    const selectedCat = categories.find(c => c.id === categoryId);
    const defaultCenter = selectedCat?.default_cost_center_id || 'none';
    if (!costCenterId || costCenterId === '' || costCenterId === 'none') {
      setCostCenterId(defaultCenter);
    }
  }, [enableCategory, categoryId, enableCostCenter, categories, costCenterId]);

  // Función para crear nueva subcategoría
  const handleCreateSubcategory = () => {
    if (!newSubcategoryName.trim() || !categoryId) return;
    
    const maxOrder = availableSubcategories.reduce(
      (max, sub) => Math.max(max, sub.display_order || 0), 0
    );
    
    createSubcategory({
      category_id: categoryId,
      name: newSubcategoryName.trim(),
      display_order: maxOrder + 1,
    }, {
      onSuccess: (data) => {
        setSubcategory(data.name);
        setNewSubcategoryName('');
      }
    });
  };

  const totalAmount = useMemo(() => {
    return selectedCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
  }, [selectedCosts]);

  const markPaidSummary = useMemo(() => {
    const alreadyPaid = selectedCosts.filter((c) => !!c.payment_date).map((c) => c.id);
    const unpaid = selectedCosts.filter((c) => !c.payment_date).map((c) => c.id);
    return { alreadyPaid, unpaid };
  }, [selectedCosts]);

  const downloadMarkPaidReport = (result: MarkCostsPaidBatchResult) => {
    const statusById = new Map<string, 'Procesado' | 'Ya pagado' | 'No encontrado'>();
    result.processed_ids.forEach((id) => statusById.set(id, 'Procesado'));
    result.already_paid_ids.forEach((id) => statusById.set(id, 'Ya pagado'));
    result.missing_ids.forEach((id) => statusById.set(id, 'No encontrado'));

    const selectedById = new Map<string, Cost>();
    selectedCosts.forEach((c) => selectedById.set(c.id, c));

    const paymentDateLabel = result.use_cost_date ? 'Fecha del costo' : (result.payment_date || '');

    const summaryRows: (string | number)[][] = [
      ['Reporte', 'Marcación masiva de costos como pagados'],
      ['Lote', result.operation_id],
      ['Ejecutado el', result.executed_at],
      ['Usuario', result.executed_by],
      ['Fecha de pago aplicada', paymentDateLabel],
      ['Total solicitados', result.requested_count ?? result.requested_ids.length],
      ['Procesados', result.processed_count ?? result.processed_ids.length],
      ['Ya pagados', result.already_paid_count ?? result.already_paid_ids.length],
      ['No encontrados', result.missing_count ?? result.missing_ids.length],
    ];

    const requestedRows = (result.requested_ids || []).map((id) => {
      const cost = selectedById.get(id);
      const status = statusById.get(id) || '';
      const appliedPaymentDate = result.use_cost_date ? (cost?.date || '') : (result.payment_date || '');

      return {
        status,
        id,
        fecha: cost?.date || '',
        pago_aplicado: appliedPaymentDate,
        descripcion: cost?.description || '',
        monto: cost?.amount ?? '',
        categoria: (cost as any)?.cost_categories?.name || '',
        subcategoria: (cost as any)?.subcategory || '',
      };
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    const wsDetails = XLSX.utils.json_to_sheet(requestedRows);
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Detalle');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_marcar_pagados_${result.operation_id}.xlsx`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) link.parentNode.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 250);
  };

  const handleMarkPaidSubmit = async () => {
    setMarkPaidError('');
    setMarkPaidResult(null);

    batchProgress.start('Marcando como pagados', selectedCosts.length);

    try {
      for (let i = 0; i < selectedCosts.length; i++) {
        batchProgress.update(i + 1, selectedCosts[i].description.substring(0, 30));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      const result = await markPaidBatch({
        costIds: selectedCosts.map((c) => c.id),
        paymentDate: markPaidUseCostDate ? null : (markPaidPaymentDate || getCurrentChileDateString()),
      });

      setMarkPaidResult(result);
      setMarkPaidStage('done');
      batchProgress.complete();
    } catch (error: any) {
      const message = error?.message || 'Error al marcar costos como pagados';
      setMarkPaidError(message);
      batchProgress.error(message);
    }
  };

  const handleSubmit = async () => {
    const fields: CostBatchUpdateData['fields'] = {};

    if (enableCategory && categoryId) fields.category_id = categoryId;
    if (enableSubcategory) {
      // Si es el valor especial "__NONE__", lo convertimos a null para limpiar
      fields.subcategory = subcategory === '__NONE__' ? null : (subcategory || null);
    }
    if (enableDate && date) fields.date = date;
    if (enablePaymentDate) fields.payment_date = paymentDate || null;
    if (enableCostCenter) fields.cost_center_id = (costCenterId && costCenterId !== 'none') ? costCenterId : null;
    if (enableSupplier) fields.supplier_id = (supplierId && supplierId !== 'none') ? supplierId : null;
    if (enableNotes && notes) fields.notes = notes;

    const updateData: CostBatchUpdateData = {
      fields,
      costIds: selectedCosts.map((c) => c.id),
      appendNotes,
    };

    batchProgress.start('Actualizando Costos', selectedCosts.length);

    try {
      // Simulate progress for better UX
      for (let i = 0; i < selectedCosts.length; i++) {
        batchProgress.update(i + 1, selectedCosts[i].description.substring(0, 30));
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for visual feedback
      }
      
      await updateBatch(updateData);
      batchProgress.complete();
      
      // Delay close to show completion
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
        batchProgress.close();
      }, 1500);
    } catch (error) {
      logger.error('Error updating batch:', error);
      batchProgress.error('Error al actualizar');
    }
  };

  const resetForm = () => {
    setEnableCategory(false);
    setEnableSubcategory(false);
    setEnableDate(false);
    setEnablePaymentDate(false);
    setEnableCostCenter(false);
    setEnableSupplier(false);
    setEnableNotes(false);
    setCategoryId('');
    setSubcategory('');
    setNewSubcategoryName('');
    setDate('');
    setPaymentDate('');
    setCostCenterId('');
    setSupplierId('');
    setNotes('');
    setAppendNotes(false);
    setMarkPaidPaymentDate(getCurrentChileDateString());
    setMarkPaidUseCostDate(true);
    setMarkPaidStage('confirm');
    setMarkPaidResult(null);
    setMarkPaidError('');
  };

  React.useEffect(() => {
    if (open) resetForm();
  }, [open]);

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const hasChanges = 
    enableCategory || 
    enableSubcategory || 
    enableDate || 
    enablePaymentDate || 
    enableCostCenter || 
    enableSupplier || 
    enableNotes;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden flex flex-col border-border/70 bg-card p-0">
        <DialogHeader className="rounded-t-lg border-b border-border/70 bg-muted/20 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2">
            {isMarkPaidMode ? (
              <CheckCircle className="size-5 text-success" />
            ) : (
              <BarChart3 className="size-5 text-primary" />
            )}
            {isMarkPaidMode ? 'Marcar como Pagados' : 'Actualización por Lotes'}
          </DialogTitle>
          <DialogDescription>
            {isMarkPaidMode
              ? 'Marca múltiples costos como pagados en una operación segura y auditable.'
              : 'Modifica múltiples costos simultáneamente. Solo se actualizarán los campos que habilites.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Resumen */}
        <Card className={isMarkPaidMode ? 'border-success/20 bg-success/5' : 'border-primary/20 bg-primary/5'}>
          <CardContent className="pt-6">
            <div className={isMarkPaidMode ? 'grid grid-cols-3 gap-4' : 'grid grid-cols-2 gap-4'}>
              <div>
                <p className="text-sm text-muted-foreground">Costos seleccionados</p>
                <p className="text-2xl font-bold">{selectedCosts.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className={isMarkPaidMode ? 'text-2xl font-bold text-success' : 'text-2xl font-bold text-primary'}>
                  ${totalAmount.toLocaleString('es-CL')}
                </p>
              </div>
              {isMarkPaidMode && (
                <div>
                  <p className="text-sm text-muted-foreground">Ya pagados</p>
                  <p className="text-2xl font-bold">{markPaidSummary.alreadyPaid.length}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isMarkPaidMode ? (
          <>
            {markPaidStage === 'confirm' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="use-cost-date"
                          checked={markPaidUseCostDate}
                          onCheckedChange={setMarkPaidUseCostDate}
                        />
                        <Label htmlFor="use-cost-date">Usar fecha del costo (mantener fecha de origen)</Label>
                      </div>

                      {!markPaidUseCostDate && (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <Calendar className="size-5 text-muted-foreground" />
                            <div className="gap-y-1 flex-1">
                              <Label>Fecha de Pago</Label>
                              <DatePickerInput
                                value={markPaidPaymentDate}
                                onChange={setMarkPaidPaymentDate}
                                placeholder="Seleccionar fecha de pago"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {markPaidUseCostDate && (
                        <div className="text-sm text-muted-foreground">
                          La fecha de pago se asignará usando la fecha original de cada costo seleccionado.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {markPaidSummary.alreadyPaid.length > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Se omitirán </span>
                        <span className="font-medium">{markPaidSummary.alreadyPaid.length}</span>
                        <span className="text-muted-foreground"> costo(s) porque ya están pagados.</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {markPaidError && (
                <Card className="border-danger/30 bg-danger/10">
                    <CardContent className="pt-6">
                    <div className="text-sm text-danger">{markPaidError}</div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {markPaidStage === 'done' && markPaidResult && (
              <div className="space-y-4">
                <Card className="border-success/30 bg-success/10">
                  <CardContent className="pt-6 space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Procesados: </span>
                      <span className="font-semibold">{markPaidResult.processed_count ?? markPaidResult.processed_ids.length}</span>
                      <span className="text-muted-foreground"> | Ya pagados: </span>
                      <span className="font-semibold">{markPaidResult.already_paid_count ?? markPaidResult.already_paid_ids.length}</span>
                      <span className="text-muted-foreground"> | No encontrados: </span>
                      <span className="font-semibold">{markPaidResult.missing_count ?? markPaidResult.missing_ids.length}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Lote: {markPaidResult.operation_id} | Fecha pago: {markPaidResult.use_cost_date ? 'Fecha del costo' : (markPaidResult.payment_date || '—')} | Usuario: {markPaidResult.executed_by}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>IDs procesados</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadMarkPaidReport(markPaidResult)}
                      >
                        <Download className="size-4 mr-2" />
                        Descargar reporte (Excel)
                      </Button>
                    </div>
                    <Textarea
                      value={markPaidResult.processed_ids.join('\n')}
                      readOnly
                      className="font-mono text-xs"
                      rows={6}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        ) : (
          <>
          <div className="space-y-4">
          {/* Categoría */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Tag className="size-5 text-muted-foreground" />
                  <div className="gap-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-category">Categoría</Label>
                      <Switch
                        id="enable-category"
                        checked={enableCategory}
                        onCheckedChange={setEnableCategory}
                      />
                    </div>
                    {enableCategory && (
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subcategoría */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Tag className="size-5 text-muted-foreground" />
                  <Label htmlFor="enable-subcategory">Subcategoría</Label>
                  <Switch
                    id="enable-subcategory"
                    checked={enableSubcategory}
                    onCheckedChange={setEnableSubcategory}
                  />
                </div>
                {enableSubcategory && (
                  <div className="space-y-3">
                    {(!enableCategory || !categoryId) ? (
                      <p className="text-sm text-muted-foreground italic">
                        Primero debes seleccionar una categoría
                      </p>
                    ) : (
                      <>
                        {availableSubcategories.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">
                            No hay subcategorías configuradas para esta categoría
                          </p>
                        ) : (
                          <Select value={subcategory} onValueChange={setSubcategory}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar subcategoría" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__NONE__">Sin subcategoría (limpiar)</SelectItem>
                              {availableSubcategories.map((sub) => (
                                <SelectItem key={sub.id} value={sub.name}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {/* Creación rápida de subcategoría */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nueva subcategoría..."
                            value={newSubcategoryName}
                            onChange={(e) => setNewSubcategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateSubcategory();
                              }
                            }}
                            disabled={isCreatingSubcategory}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateSubcategory}
                            disabled={isCreatingSubcategory || !newSubcategoryName.trim()}
                          >
                            {isCreatingSubcategory ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="size-4 mr-1" />
                                Agregar
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fecha */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Calendar className="size-5 text-muted-foreground" />
                  <div className="gap-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-date">Fecha</Label>
                      <Switch
                        id="enable-date"
                        checked={enableDate}
                        onCheckedChange={setEnableDate}
                      />
                    </div>
                    {enableDate && (
                      <DatePickerInput
                        value={date}
                        onChange={setDate}
                        placeholder="Seleccionar fecha"
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fecha de Pago */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Calendar className="size-5 text-muted-foreground" />
                  <div className="gap-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-payment-date">Fecha de Pago</Label>
                      <Switch
                        id="enable-payment-date"
                        checked={enablePaymentDate}
                        onCheckedChange={setEnablePaymentDate}
                      />
                    </div>
                    {enablePaymentDate && (
                      <DatePickerInput
                        value={paymentDate}
                        onChange={setPaymentDate}
                        placeholder="Dejar vacío para limpiar"
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Centro de Costos */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Building2 className="size-5 text-muted-foreground" />
                  <div className="gap-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-cost-center">Centro de Costos</Label>
                      <Switch
                        id="enable-cost-center"
                        checked={enableCostCenter}
                        onCheckedChange={setEnableCostCenter}
                      />
                    </div>
                    {enableCostCenter && (
                      <Select value={costCenterId} onValueChange={setCostCenterId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar centro de costos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin centro de costos</SelectItem>
                          {costCenters.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.code} - {cc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {enableCategory && enableCostCenter && categoryId && (!costCenterId || costCenterId === 'none') && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Se sugerirá el centro por defecto de la categoría seleccionada.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proveedor */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <User className="size-5 text-muted-foreground" />
                  <div className="gap-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-supplier">Proveedor</Label>
                      <Switch
                        id="enable-supplier"
                        checked={enableSupplier}
                        onCheckedChange={setEnableSupplier}
                      />
                    </div>
                    {enableSupplier && (
                      <SupplierCombobox
                        value={supplierId || null}
                        onValueChange={(val) => setSupplierId(val || '')}
                        placeholder="Buscar proveedor por nombre o RUT..."
                        allowCreate={false}
                        noneLabel="Sin proveedor"
                        showNoneOption={true}
                        options={supplierOptions}
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="size-5 text-muted-foreground" />
                  <div className="gap-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-notes">Notas</Label>
                      <Switch
                        id="enable-notes"
                        checked={enableNotes}
                        onCheckedChange={setEnableNotes}
                      />
                    </div>
                    {enableNotes && (
                      <>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Nota común para todos los costos"
                          rows={3}
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Switch
                            id="append-notes"
                            checked={appendNotes}
                            onCheckedChange={setAppendNotes}
                          />
                          <Label htmlFor="append-notes" className="text-sm text-muted-foreground">
                            Añadir a notas existentes (en lugar de reemplazar)
                          </Label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        {hasChanges && selectedCosts.length <= 3 && (
          <Card className="bg-muted/20">
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-3">Vista previa de cambios:</p>
              <div className="space-y-2">
                {selectedCosts.slice(0, 3).map((cost) => (
                  <div key={cost.id} className="text-sm">
                    <Badge variant="outline" className="mr-2">
                      {cost.description.substring(0, 30)}...
                    </Badge>
                    <span className="text-muted-foreground">
                      ${Number(cost.amount).toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

          </>
        )}

        </div>
        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button
            variant="outline"
            className="border-border/70 bg-background/60"
            onClick={handleClose}
            disabled={isMarkPaidMode ? isMarkingPaid : isUpdating}
          >
            Cancelar
          </Button>
          {isMarkPaidMode ? (
            markPaidStage === 'confirm' ? (
              <Button
                onClick={handleMarkPaidSubmit}
                disabled={selectedCosts.length === 0 || isMarkingPaid}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                {isMarkingPaid ? 'Marcando...' : `Marcar ${selectedCosts.length} como pagados`}
              </Button>
            ) : (
              <Button onClick={handleClose} className="bg-success text-success-foreground hover:bg-success/90">
                Cerrar
              </Button>
            )
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!hasChanges || isUpdating}
            >
              {isUpdating ? 'Actualizando...' : `Actualizar ${selectedCosts.length} costos`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <BatchProgressModal
        state={batchProgress.state}
        onClose={batchProgress.close}
      />
    </Dialog>
  );
};
