
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Receipt, Calculator, Info } from 'lucide-react';
import { useServiceCosts } from '@/hooks/useServiceCosts';
import { useAddCost, useUpdateCost, useDeleteCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { toast } from 'sonner';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';
import { debounce } from 'lodash';
import { supabase } from '@/integrations/supabase/client';
import { AutocompleteInput } from '@/components/common/AutocompleteInput';
import { useFrequentCostDescriptions, useFrequentCostLocations } from '@/hooks/useFrequentFormData';
import { useQuery } from '@tanstack/react-query';
import { CostSubcategory } from '@/types/costs';
import { useOperators } from '@/hooks/useOperators';
import { SupplierCombobox } from '@/components/costs/form/SupplierSelector';

interface ServiceCostDetail {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  notes?: string;
  category_id: string;
  subcategory?: string;
  supplier_id?: string;
  operator_id?: string;
  document_type?: string;
  document_number?: string;
  location_text?: string;
  other_reason?: string;
  purchase_quantity?: number;
  purchase_unit_cost?: number;
  immediate_consumption?: boolean;
  date?: string;
  isExisting?: boolean;
}

interface ServiceCostDetailsSectionProps {
  serviceId?: string;
  serviceDate?: string;
  costDetails: ServiceCostDetail[];
  onCostDetailsChange: (costDetails: ServiceCostDetail[]) => void;
  disabled?: boolean;
}

export const ServiceCostDetailsSection = ({
  serviceId,
  serviceDate,
  costDetails,
  onCostDetailsChange,
  disabled = false
}: ServiceCostDetailsSectionProps) => {
  console.log('[ServiceCostDetailsSection] Rendered with serviceId:', serviceId, 'costDetails:', costDetails);
  console.log('[ServiceCostDetailsSection] Disabled prop:', disabled);
  console.log('[ServiceCostDetailsSection] Add button should be disabled?', disabled);
  
  const [nextId, setNextId] = useState(1);
  const { data: categories = [] } = useCostCategories();
  const costDescriptionSuggestions = useFrequentCostDescriptions();
  const costLocationSuggestions = useFrequentCostLocations();
  const { data: existingCosts, isLoading: existingCostsLoading, refetch: refetchCosts } = useServiceCosts(serviceId || null);
  const { mutate: addCost } = useAddCost();
  const { mutate: updateCost } = useUpdateCost();
  const { mutate: deleteCost } = useDeleteCost();
  const { operators = [] } = useOperators();

  const { data: serviceMeta } = useQuery({
    queryKey: ['service-cost-meta', serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const { data, error } = await supabase
        .from('services')
        .select('id, folio, crane_id')
        .eq('id', serviceId)
        .single();
      if (error) throw error;
      return data as { id: string; folio: string; crane_id: string | null };
    },
    enabled: !!serviceId,
    staleTime: 60 * 1000,
  });

  // Track selected categories to load their subcategories dynamically
  const [subcategoriesCache, setSubcategoriesCache] = useState<Record<string, CostSubcategory[]>>({});
  const inventoryKeywords = [
    'filtro',
    'racor',
    'aceite',
    'lubric',
    'hidraul',
    'repuesto',
    'correa',
    'rodamiento',
    'manguera',
    'bomba',
    'alternador',
    'bateria',
    'pastilla',
    'disco',
    'embrague',
    'neumatic',
    'llanta',
  ];

  // Filter out commission costs - these are handled by MultipleOperatorsSection
  const commissionCategoryId = categories.find(cat => 
    cat.name.toLowerCase().includes('comisión') || 
    cat.name.toLowerCase().includes('comision')
  )?.id;

  const filteredExistingCosts = existingCosts?.filter(cost => 
    cost.category_id !== commissionCategoryId
  ) || [];

  // Load existing costs when editing a service (excluding commissions)
  useEffect(() => {
    // Only load if we have a serviceId, categories are loaded, existing costs are available, 
    // and we haven't loaded costs yet
    if (serviceId && 
        categories.length > 0 && 
        filteredExistingCosts.length > 0 && 
        costDetails.length === 0 && 
        !existingCostsLoading) {
      
      console.log('[ServiceCostDetailsSection] Loading existing costs (excluding commissions):', filteredExistingCosts);
      
      const mappedCosts = filteredExistingCosts.map(cost => ({
        id: cost.id,
        description: cost.description,
        amount: Number(cost.amount),
        quantity: 1,
        unitPrice: Number(cost.amount),
        notes: cost.notes || '',
        category_id: cost.category_id,
        subcategory: cost.subcategory || '',
        supplier_id: cost.supplier_id || undefined,
        operator_id: cost.operator_id || undefined,
        document_type: (cost as any).document_type || undefined,
        document_number: (cost as any).document_number || undefined,
        location_text: (cost as any).location_text || undefined,
        other_reason: (cost as any).other_reason || undefined,
        purchase_quantity: cost.purchase_quantity || undefined,
        purchase_unit_cost: cost.purchase_unit_cost || undefined,
        immediate_consumption: !!cost.immediate_consumption,
        date: cost.date, // Preserve original date
        isExisting: true
      }));
      
      onCostDetailsChange(mappedCosts);
    }
  }, [serviceId, categories.length, filteredExistingCosts.length, costDetails.length, existingCostsLoading, onCostDetailsChange]);

  // Filter categories to exclude commission categories
  const nonCommissionCategories = categories.filter(cat => 
    !cat.name.toLowerCase().includes('comisión') && 
    !cat.name.toLowerCase().includes('comision')
  );

  // ✅ AGREGAR: Estado para prevenir doble clic
  const [isAddingCost, setIsAddingCost] = useState(false);
  
  const addCostDetail = () => {
    if (isAddingCost) return; // Prevenir múltiples clics
    
    setIsAddingCost(true);
    
    const newCostDetail: ServiceCostDetail = {
      id: `temp-${Date.now()}`,
      description: '',
      amount: 0,
      category_id: '',
      subcategory: '',
      notes: '',
      quantity: 1,
      unitPrice: 0,
      isExisting: false
    };
    
    onCostDetailsChange([...costDetails, newCostDetail]);
    
    // Resetear el flag después de un breve delay
    setTimeout(() => setIsAddingCost(false), 300);
  };

  const removeCostDetail = async (id: string) => {
    const costToRemove = costDetails.find(cost => cost.id === id);
    
    if (costToRemove?.isExisting && serviceId) {
      // Delete from database if it's an existing cost
      deleteCost(id, {
        onSuccess: () => {
          console.log('[ServiceCostDetailsSection] Cost deleted successfully:', id);
          onCostDetailsChange(costDetails.filter(cost => cost.id !== id));
          refetchCosts();
          toast.success("Costo eliminado correctamente");
        },
        onError: (error) => {
          console.error('[ServiceCostDetailsSection] Error deleting cost:', error);
          toast.error("Error al eliminar el costo");
        }
      });
    } else {
      // Just remove from local state if it's a new cost
      onCostDetailsChange(costDetails.filter(cost => cost.id !== id));
    }
  };

  const updateCostDetail = (id: string, field: keyof ServiceCostDetail, value: any) => {
    onCostDetailsChange(
      costDetails.map(cost => {
        if (cost.id === id) {
          const updated = { ...cost, [field]: value };
          
          // Auto-calcular amount si se cambia quantity o unitPrice
          if (field === 'quantity' || field === 'unitPrice') {
            const quantity = field === 'quantity' ? value : updated.quantity || 1;
            const unitPrice = field === 'unitPrice' ? value : updated.unitPrice || 0;
            updated.amount = quantity * unitPrice;
          }

          if (field === 'purchase_quantity' || field === 'purchase_unit_cost') {
            const purchaseQuantity = field === 'purchase_quantity' ? value : updated.purchase_quantity || 0;
            const purchaseUnitCost = field === 'purchase_unit_cost' ? value : updated.purchase_unit_cost || 0;
            if (purchaseQuantity && purchaseUnitCost) {
              updated.amount = Number(purchaseQuantity) * Number(purchaseUnitCost);
            }
          }
          
          // Si se cambia la categoría, limpiar la subcategoría
          if (field === 'category_id') {
            updated.subcategory = '';
          }
          
          return updated;
        }
        return cost;
      })
    );
  };

  const getSubcategoriesForCategory = (categoryId: string): CostSubcategory[] => {
    if (!categoryId) return [];
    return subcategoriesCache[categoryId] || [];
  };

  const getSubcategoryConfig = (categoryId: string, subcategoryName?: string) => {
    if (!categoryId || !subcategoryName) return null;
    return getSubcategoriesForCategory(categoryId).find(s => s.name === subcategoryName) || null;
  };

  const saveCostDetail = async (costDetail: ServiceCostDetail) => {
    if (!serviceId) {
      console.log('[ServiceCostDetailsSection] No serviceId, cost will be saved on service creation');
      return;
    }

    const selectedCategoryName = nonCommissionCategories.find(cat => cat.id === costDetail.category_id)?.name || '';
    const inventarioCategoryId = nonCommissionCategories.find(cat => cat.name === 'Inventario')?.id;
    const normalizedDesc = (costDetail.description || '').toLowerCase();
    const matchesInventoryKeyword = inventoryKeywords.some(k => normalizedDesc.includes(k));

    if (selectedCategoryName === 'Gastos de Servicios' && matchesInventoryKeyword && inventarioCategoryId) {
      updateCostDetail(costDetail.id, 'category_id', inventarioCategoryId);
      updateCostDetail(costDetail.id, 'subcategory', '');
      updateCostDetail(costDetail.id, 'purchase_quantity', costDetail.quantity || 1);
      updateCostDetail(costDetail.id, 'purchase_unit_cost', costDetail.unitPrice || 0);
      updateCostDetail(costDetail.id, 'immediate_consumption', true);
      toast.info('Se detectó una compra para grúa, se cambió a Inventario para registrar en bodega.');
      return;
    }

    if (!costDetail.category_id) {
      toast.error("Debe seleccionar una categoría");
      return;
    }

    // Validar subcategoría si es requerida para la categoría seleccionada
    const requiredSubcategories = getSubcategoriesForCategory(costDetail.category_id);
    if (requiredSubcategories.length > 0 && !costDetail.subcategory?.trim()) {
      toast.error("Debe seleccionar una subcategoría");
      return;
    }

    const subcategoryConfig = getSubcategoryConfig(costDetail.category_id, costDetail.subcategory);
    if (subcategoryConfig?.requires_supplier && !costDetail.supplier_id) {
      toast.error("Debe seleccionar un proveedor");
      return;
    }

    if (subcategoryConfig?.requires_operator && !costDetail.operator_id) {
      toast.error("Debe seleccionar un operador");
      return;
    }

    if (subcategoryConfig?.requires_location && !costDetail.location_text?.trim()) {
      toast.error("Debe indicar ubicación o tramo");
      return;
    }

    if (subcategoryConfig?.requires_document && !costDetail.document_number?.trim()) {
      toast.error("Debe indicar un documento (número)");
      return;
    }

    if (subcategoryConfig?.requires_other_reason && !costDetail.other_reason?.trim()) {
      toast.error("Debe seleccionar un motivo");
      return;
    }

    if (subcategoryConfig?.routes_to_inventory) {
      if (!costDetail.purchase_quantity || costDetail.purchase_quantity <= 0) {
        toast.error("Debe indicar cantidad de compra");
        return;
      }
      if (!costDetail.purchase_unit_cost || costDetail.purchase_unit_cost <= 0) {
        toast.error("Debe indicar costo unitario");
        return;
      }
    }

    if (!costDetail.description.trim()) {
      toast.error("La descripción es obligatoria");
      return;
    }

    if (costDetail.amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    const costDate = costDetail.isExisting && costDetail.date ? costDetail.date : (serviceDate || getCurrentChileDateString());
    // Buscar payment_date previo si es un costo existente (no sobreescribir pago manual previo)
    const existingCost = costDetail.isExisting
      ? existingCosts?.find(c => c.id === costDetail.id)
      : undefined;
    const existingPaymentDate = (existingCost as any)?.payment_date ?? null;
    // Regla de negocio: gastos operativos de servicios se marcan como pagados por defecto
    // (esta sección excluye comisiones, así que aplica a todos los costos de aquí).
    const resolvedPaymentDate = costDetail.isExisting
      ? (existingPaymentDate ?? costDate)
      : costDate;
    const costData = {
      service_id: serviceId,
      category_id: costDetail.category_id,
      description: costDetail.description.trim(),
      amount: costDetail.amount,
      date: costDate,
      payment_date: resolvedPaymentDate,
      notes: costDetail.notes || '',
      subcategory: costDetail.subcategory || '',
      crane_id: serviceMeta?.crane_id || null,
      service_folio: serviceMeta?.folio || null,
      supplier_id: costDetail.supplier_id || null,
      operator_id: costDetail.operator_id || null,
      document_type: costDetail.document_type || null,
      document_number: costDetail.document_number || null,
      location_text: costDetail.location_text || null,
      other_reason: costDetail.other_reason || null,
      purchase_quantity: costDetail.purchase_quantity || null,
      purchase_unit_cost: costDetail.purchase_unit_cost || null,
      immediate_consumption: !!costDetail.immediate_consumption,
    };

    if (costDetail.isExisting) {
      // Update existing cost
      updateCost({ id: costDetail.id, ...costData }, {
        onSuccess: () => {
          console.log('[ServiceCostDetailsSection] Cost updated successfully:', costDetail.id);
          refetchCosts();
          toast.success("Costo actualizado correctamente");
        },
        onError: (error) => {
          console.error('[ServiceCostDetailsSection] Error updating cost:', error);
          toast.error("Error al actualizar el costo");
        }
      });
    } else {
      // Add new cost
      addCost(costData, {
        onSuccess: (data) => {
          console.log('[ServiceCostDetailsSection] Cost added successfully:', data);
          
          // Update the cost detail with the new ID from database
          if (data && data[0]) {
            updateCostDetail(costDetail.id, 'id', data[0].id);
            updateCostDetail(costDetail.id, 'isExisting', true);
          }
          
          refetchCosts();
          toast.success("Costo agregado correctamente");
        },
        onError: (error) => {
          console.error('[ServiceCostDetailsSection] Error adding cost:', error);
          toast.error("Error al agregar el costo");
        }
      });
    }
  };

  // ✅ NUEVO: Debounce para prevenir múltiples llamadas rápidas - MOVED INSIDE COMPONENT
  const debouncedSaveCostDetail = useCallback(
    debounce(async (costDetail: ServiceCostDetail) => {
      await saveCostDetail(costDetail);
    }, 300),
    [serviceId, updateCost, addCost, updateCostDetail, refetchCosts]
  );

  const getTotalCosts = () => {
    return costDetails.reduce((total, cost) => total + (cost.amount || 0), 0);
  };

  const getCostsByCategory = () => {
    const grouped = costDetails.reduce((acc, cost) => {
      const categoryName = nonCommissionCategories.find(cat => cat.id === cost.category_id)?.name || 'Sin categoría';
      if (!acc[categoryName]) acc[categoryName] = 0;
      acc[categoryName] += cost.amount || 0;
      return acc;
    }, {} as Record<string, number>);

    return grouped;
  };

  // Load subcategories dynamically when category is selected
  useEffect(() => {
    const loadSubcategoriesForCategories = async () => {
      const uniqueCategoryIds = [...new Set(costDetails.map(cost => cost.category_id).filter(Boolean))];
      
      for (const categoryId of uniqueCategoryIds) {
        if (!subcategoriesCache[categoryId]) {
          const { data } = await supabase
            .from('cost_subcategories')
            .select('*')
            .eq('category_id', categoryId)
            .eq('is_active', true)
            .order('display_order', { ascending: true });
          
          if (data) {
            setSubcategoriesCache(prev => ({
              ...prev,
              [categoryId]: data as CostSubcategory[]
            }));
          }
        }
      }
    };

    if (costDetails.length > 0) {
      loadSubcategoriesForCategories();
    }
  }, [costDetails.map(c => c.category_id).join(',')]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="size-5" />
          Costos Detallados del Servicio
        </CardTitle>
        {/* Información sobre comisiones */}
        <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg text-sm">
          <Info className="size-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-muted-foreground">
            <strong>Nota:</strong> Las comisiones de operadores se manejan en la sección "Operadores del Servicio" arriba. 
            Esta sección es para otros costos operacionales como combustible, peajes, materiales, etc.
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {costDetails.map((cost, index) => (
          <div key={cost.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">
                Costo {index + 1} 
                {cost.isExisting && <span className="text-xs text-green-600 ml-2">(Guardado)</span>}
              </h4>
              <div className="flex gap-2">
                {serviceId && !disabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveCostDetail(cost)}
                    disabled={!cost.category_id || !cost.description.trim() || cost.amount <= 0}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {cost.isExisting ? 'Actualizar' : 'Guardar'}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeCostDetail(cost.id)}
                  disabled={disabled}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Categoría */}
              <div className="space-y-2">
                <Label>Categoría *</Label>
                <Select
                  value={cost.category_id}
                  onValueChange={(value) => updateCostDetail(cost.id, 'category_id', value)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {nonCommissionCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategoría */}
              {cost.category_id && getSubcategoriesForCategory(cost.category_id).length > 0 && (
                <div className="space-y-2">
                  <Label>Subcategoría *</Label>
                  <Select
                    value={cost.subcategory || ''}
                    onValueChange={(value) => updateCostDetail(cost.id, 'subcategory', value)}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar subcategoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSubcategoriesForCategory(cost.category_id).map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.name}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Descripción */}
              <div className="space-y-2">
                <Label>Descripción *</Label>
                <AutocompleteInput
                  value={cost.description}
                  onValueChange={(val) => updateCostDetail(cost.id, 'description', val)}
                  suggestions={costDescriptionSuggestions}
                  placeholder="Ej: Combustible, peajes, etc."
                  disabled={disabled}
                />
              </div>

              {/* Cantidad */}
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  value={cost.quantity || 1}
                  onChange={(e) => updateCostDetail(cost.id, 'quantity', Number(e.target.value))}
                  placeholder="1"
                  min="0"
                  step="0.01"
                  disabled={disabled}
                />
              </div>

              {/* Precio Unitario */}
              <div className="space-y-2">
                <Label>Precio Unitario (CLP)</Label>
                <Input
                  type="number"
                  value={cost.unitPrice || 0}
                  onChange={(e) => updateCostDetail(cost.id, 'unitPrice', Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  disabled={disabled}
                />
              </div>

              {/* Monto Total */}
              <div className="space-y-2">
                <Label>Monto Total (CLP) *</Label>
                <Input
                  type="number"
                  value={cost.amount}
                  onChange={(e) => updateCostDetail(cost.id, 'amount', Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  disabled={disabled}
                  className="font-semibold"
                />
              </div>

              {(() => {
                const categoryName = nonCommissionCategories.find(cat => cat.id === cost.category_id)?.name || '';
                const cfg = getSubcategoryConfig(cost.category_id, cost.subcategory);
                const shouldShowInventoryFields = categoryName === 'Inventario' || !!cfg?.routes_to_inventory;
                const shouldShowSupplier = !!cfg?.requires_supplier;
                const shouldShowOperator = !!cfg?.requires_operator;
                const shouldShowLocation = !!cfg?.requires_location;
                const shouldShowDocument = !!cfg?.requires_document;
                const shouldShowOtherReason = !!cfg?.requires_other_reason;

                const otherReasons = Array.isArray((cfg as any)?.other_reasons)
                  ? ((cfg as any).other_reasons as any[]).map(v => String(v)).filter(Boolean)
                  : [];

                return (
                  <>
                    {shouldShowSupplier && (
                      <div className="space-y-2">
                        <Label>Proveedor *</Label>
                        <SupplierCombobox
                          value={cost.supplier_id ?? null}
                          onValueChange={(value) => updateCostDetail(cost.id, 'supplier_id', value ?? undefined)}
                          placeholder="Seleccionar proveedor"
                          noneLabel="Sin proveedor"
                          allowCreate
                          disabled={disabled}
                        />
                      </div>
                    )}

                    {shouldShowOperator && (
                      <div className="space-y-2">
                        <Label>Operador *</Label>
                        <Select
                          value={cost.operator_id || 'none'}
                          onValueChange={(value) => updateCostDetail(cost.id, 'operator_id', value === 'none' ? undefined : value)}
                          disabled={disabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar operador" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin operador</SelectItem>
                            {operators.map((operator) => (
                              <SelectItem key={operator.id} value={operator.id}>
                                {operator.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {shouldShowLocation && (
                      <div className="space-y-2">
                        <Label>Ubicación / Tramo *</Label>
                        <AutocompleteInput
                          value={cost.location_text || ''}
                          onValueChange={(val) => updateCostDetail(cost.id, 'location_text', val)}
                          suggestions={costLocationSuggestions}
                          placeholder="Ej: Ruta 5 - Tramo X / Plaza Y"
                          disabled={disabled}
                        />
                      </div>
                    )}

                    {shouldShowDocument && (
                      <>
                        <div className="space-y-2">
                          <Label>Tipo de Documento</Label>
                          <Select
                            value={cost.document_type || 'none'}
                            onValueChange={(value) => updateCostDetail(cost.id, 'document_type', value === 'none' ? undefined : value)}
                            disabled={disabled}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin tipo</SelectItem>
                              <SelectItem value="Factura">Factura</SelectItem>
                              <SelectItem value="Boleta">Boleta</SelectItem>
                              <SelectItem value="Otro">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Número de Documento *</Label>
                          <Input
                            value={cost.document_number || ''}
                            onChange={(e) => updateCostDetail(cost.id, 'document_number', e.target.value)}
                            placeholder="Ej: 243232"
                            disabled={disabled}
                          />
                        </div>
                      </>
                    )}

                    {shouldShowOtherReason && (
                      <div className="space-y-2">
                        <Label>Motivo *</Label>
                        <Select
                          value={cost.other_reason || ''}
                          onValueChange={(value) => updateCostDetail(cost.id, 'other_reason', value)}
                          disabled={disabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar motivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {(otherReasons.length > 0 ? otherReasons : [
                              'Error de proveedor / documento pendiente',
                              'Gasto extraordinario no recurrente',
                              'Ajuste / regularización',
                              'Diferencia de caja / vuelto',
                              'Otro (justificar)'
                            ]).map((reason) => (
                              <SelectItem key={reason} value={reason}>
                                {reason}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {shouldShowInventoryFields && (
                      <>
                        <div className="space-y-2">
                          <Label>Cantidad (Bodega) *</Label>
                          <Input
                            type="number"
                            value={cost.purchase_quantity ?? ''}
                            onChange={(e) => updateCostDetail(cost.id, 'purchase_quantity', e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="1"
                            min="1"
                            step="1"
                            disabled={disabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Costo Unitario (Bodega) *</Label>
                          <Input
                            type="number"
                            value={cost.purchase_unit_cost ?? ''}
                            onChange={(e) => updateCostDetail(cost.id, 'purchase_unit_cost', e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            disabled={disabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Consumo inmediato</Label>
                          <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-background">
                            <Checkbox
                              checked={!!cost.immediate_consumption}
                              onCheckedChange={(checked) => updateCostDetail(cost.id, 'immediate_consumption', !!checked)}
                              disabled={disabled}
                            />
                            <span className="text-sm text-muted-foreground">Registrar salida automática a la grúa del servicio</span>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}

              {/* Notas */}
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={cost.notes || ''}
                  onChange={(e) => updateCostDetail(cost.id, 'notes', e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={2}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Botón para agregar costo */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={addCostDetail}
            disabled={disabled || isAddingCost}
            className="flex items-center gap-2 bg-green-100 hover:bg-green-200"
          >
            <Plus className="size-4" />
            {isAddingCost ? 'Agregando...' : 'Agregar Costo'}
          </Button>

          {/* Resumen de costos */}
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2">
              <Calculator className="size-4" />
              <Label className="text-sm text-muted-foreground">Total Costos:</Label>
            </div>
            <div className="text-lg font-semibold text-blue-600">
              ${getTotalCosts().toLocaleString('es-CL')} CLP
            </div>
          </div>
        </div>

        {/* Resumen por categoría */}
        {costDetails.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
            <h5 className="font-medium mb-2 text-foreground">Resumen por Categoría:</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {Object.entries(getCostsByCategory()).map(([category, amount]) => (
                <div key={category} className="flex justify-between">
                  <span className="text-muted-foreground">{category}:</span>
                  <span className="font-medium text-foreground">${amount.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
