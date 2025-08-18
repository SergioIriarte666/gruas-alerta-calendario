
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Receipt, Calculator, Info } from 'lucide-react';
import { useServiceCosts } from '@/hooks/useServiceCosts';
import { useAddCost, useUpdateCost, useDeleteCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { toast } from 'sonner';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';
import { useCallback } from 'react';
import { debounce } from 'lodash';

interface ServiceCostDetail {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  notes?: string;
  category_id: string;
  subcategory?: string;
  isExisting?: boolean;
}

interface ServiceCostDetailsSectionProps {
  serviceId?: string;
  costDetails: ServiceCostDetail[];
  onCostDetailsChange: (costDetails: ServiceCostDetail[]) => void;
  disabled?: boolean;
}

export const ServiceCostDetailsSection = ({
  serviceId,
  costDetails,
  onCostDetailsChange,
  disabled = false
}: ServiceCostDetailsSectionProps) => {
  console.log('[ServiceCostDetailsSection] Rendered with serviceId:', serviceId, 'costDetails:', costDetails);
  console.log('[ServiceCostDetailsSection] Disabled prop:', disabled);
  console.log('[ServiceCostDetailsSection] Add button should be disabled?', disabled);
  
  const [nextId, setNextId] = useState(1);
  const { data: categories = [] } = useCostCategories();
  const { data: existingCosts, isLoading: existingCostsLoading, refetch: refetchCosts } = useServiceCosts(serviceId || null);
  const { mutate: addCost } = useAddCost();
  const { mutate: updateCost } = useUpdateCost();
  const { mutate: deleteCost } = useDeleteCost();

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
        isExisting: true
      }));
      
      onCostDetailsChange(mappedCosts);
    }
  }, [serviceId, categories.length, filteredExistingCosts.length, costDetails.length, existingCostsLoading]);

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
    
    const newCostDetail: CostDetail = {
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
    
    setCostDetails(prev => [...prev, newCostDetail]);
    
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
          
          return updated;
        }
        return cost;
      })
    );
  };

  const saveCostDetail = async (costDetail: ServiceCostDetail) => {
    if (!serviceId) {
      console.log('[ServiceCostDetailsSection] No serviceId, cost will be saved on service creation');
      return;
    }

    if (!costDetail.category_id) {
      toast.error("Debe seleccionar una categoría");
      return;
    }

    if (!costDetail.description.trim()) {
      toast.error("La descripción es obligatoria");
      return;
    }

    if (costDetail.amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    const costData = {
      service_id: serviceId,
      category_id: costDetail.category_id,
      description: costDetail.description.trim(),
      amount: costDetail.amount,
      date: getCurrentChileDateString(),
      notes: costDetail.notes || '',
      subcategory: costDetail.subcategory || ''
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Costos Detallados del Servicio
        </CardTitle>
        {/* Información sobre comisiones */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-blue-800">
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
                  <Trash2 className="h-4 w-4" />
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

              {/* Descripción */}
              <div className="space-y-2">
                <Label>Descripción *</Label>
                <Input
                  value={cost.description}
                  onChange={(e) => updateCostDetail(cost.id, 'description', e.target.value)}
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
            disabled={disabled}
            className="flex items-center gap-2 bg-green-100 hover:bg-green-200"
          >
            <Plus className="h-4 w-4" />
            Agregar Costo
          </Button>

          {/* Resumen de costos */}
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              <Label className="text-sm text-muted-foreground">Total Costos:</Label>
            </div>
            <div className="text-lg font-semibold text-blue-600">
              ${getTotalCosts().toLocaleString('es-CL')} CLP
            </div>
          </div>
        </div>

        {/* Resumen por categoría */}
        {costDetails.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h5 className="font-medium mb-2">Resumen por Categoría:</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {Object.entries(getCostsByCategory()).map(([category, amount]) => (
                <div key={category} className="flex justify-between">
                  <span>{category}:</span>
                  <span className="font-medium">${amount.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


// ✅ NUEVO: Debounce para prevenir múltiples llamadas rápidas
const debouncedSaveCostDetail = useCallback(
  debounce(async (costDetail: CostDetail, index: number) => {
    // Lógica original de saveCostDetail
    if (!serviceId) {
      console.log('[ServiceCostDetailsSection] No serviceId, cost will be saved on service creation');
      return;
    }

    if (!costDetail.category_id) {
      toast.error("Debe seleccionar una categoría");
      return;
    }

    if (!costDetail.description.trim()) {
      toast.error("La descripción es obligatoria");
      return;
    }

    if (costDetail.amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    const costData = {
      service_id: serviceId,
      category_id: costDetail.category_id,
      description: costDetail.description.trim(),
      amount: costDetail.amount,
      date: getCurrentChileDateString(),
      notes: costDetail.notes || '',
      subcategory: costDetail.subcategory || ''
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
  }, 300),
  [serviceId, updateCost, addCost, updateCostDetail, refetchCosts]
);
