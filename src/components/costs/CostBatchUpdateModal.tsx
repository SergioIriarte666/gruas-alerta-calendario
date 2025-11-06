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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cost } from '@/types/costs';
import { CostBatchUpdateData, useUpdateCostsBatch } from '@/hooks/useUpdateCostsBatch';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useInventorySuppliers } from '@/hooks/useInventory';
import { BarChart3, Calendar, Tag, Building2, User, FileText } from 'lucide-react';

interface CostBatchUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCosts: Cost[];
}

export const CostBatchUpdateModal = ({
  open,
  onOpenChange,
  selectedCosts,
}: CostBatchUpdateModalProps) => {
  const { mutateAsync: updateBatch, isPending } = useUpdateCostsBatch();
  const { data: categories = [] } = useCostCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: suppliers = [] } = useInventorySuppliers();

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

  // Hook para obtener subcategorías basadas en la categoría seleccionada
  const { subcategories: availableSubcategories = [] } = useCostSubcategories(
    enableCategory && categoryId ? categoryId : undefined
  );

  // Limpiar subcategoría cuando cambia la categoría
  React.useEffect(() => {
    if (enableCategory && categoryId) {
      setSubcategory('');
    }
  }, [categoryId, enableCategory]);

  const totalAmount = useMemo(() => {
    return selectedCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
  }, [selectedCosts]);

  const handleSubmit = async () => {
    const fields: CostBatchUpdateData['fields'] = {};

    if (enableCategory && categoryId) fields.category_id = categoryId;
    if (enableSubcategory) {
      // Si es el valor especial "__NONE__", lo convertimos a null para limpiar
      fields.subcategory = subcategory === '__NONE__' ? null : (subcategory || null);
    }
    if (enableDate && date) fields.date = date;
    if (enablePaymentDate) fields.payment_date = paymentDate || null;
    if (enableCostCenter) fields.cost_center_id = costCenterId || null;
    if (enableSupplier) fields.supplier_id = supplierId || null;
    if (enableNotes && notes) fields.notes = notes;

    const updateData: CostBatchUpdateData = {
      fields,
      costIds: selectedCosts.map((c) => c.id),
      appendNotes,
    };

    try {
      await updateBatch(updateData);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error updating batch:', error);
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
    setDate('');
    setPaymentDate('');
    setCostCenterId('');
    setSupplierId('');
    setNotes('');
    setAppendNotes(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Actualización por Lotes
          </DialogTitle>
          <DialogDescription>
            Modifica múltiples costos simultáneamente. Solo se actualizarán los campos que habilites.
          </DialogDescription>
        </DialogHeader>

        {/* Resumen */}
        <Card className="bg-muted/20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Costos seleccionados</p>
                <p className="text-2xl font-bold">{selectedCosts.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">
                  ${totalAmount.toLocaleString('es-CL')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campos configurables */}
        <div className="space-y-4">
          {/* Categoría */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Tag className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1 flex-1">
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
                  <Tag className="h-5 w-5 text-muted-foreground" />
                  <Label htmlFor="enable-subcategory">Subcategoría</Label>
                  <Switch
                    id="enable-subcategory"
                    checked={enableSubcategory}
                    onCheckedChange={setEnableSubcategory}
                  />
                </div>
                {enableSubcategory && (
                  <div className="space-y-2">
                    {(!enableCategory || !categoryId) ? (
                      <p className="text-sm text-muted-foreground italic">
                        Primero debes seleccionar una categoría
                      </p>
                    ) : availableSubcategories.length === 0 ? (
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
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-date">Fecha</Label>
                      <Switch
                        id="enable-date"
                        checked={enableDate}
                        onCheckedChange={setEnableDate}
                      />
                    </div>
                    {enableDate && (
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
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
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-payment-date">Fecha de Pago</Label>
                      <Switch
                        id="enable-payment-date"
                        checked={enablePaymentDate}
                        onCheckedChange={setEnablePaymentDate}
                      />
                    </div>
                    {enablePaymentDate && (
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
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
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1 flex-1">
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
                          <SelectItem value="">Sin centro de costos</SelectItem>
                          {costCenters.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.code} - {cc.name}
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

          {/* Proveedor */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="enable-supplier">Proveedor</Label>
                      <Switch
                        id="enable-supplier"
                        checked={enableSupplier}
                        onCheckedChange={setEnableSupplier}
                      />
                    </div>
                    {enableSupplier && (
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin proveedor</SelectItem>
                          {suppliers.map((sup) => (
                            <SelectItem key={sup.id} value={sup.id}>
                              {sup.name}
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

          {/* Notas */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1 flex-1">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanges || isPending}>
            {isPending ? 'Actualizando...' : `Actualizar ${selectedCosts.length} costos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
