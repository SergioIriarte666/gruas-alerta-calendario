
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Package, DollarSign, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useInventoryLocations, useInventorySuppliers, useUpdateInventoryMovement, type InventoryMovement } from '@/hooks/useInventory';

interface MovementEditModalProps {
  movement: InventoryMovement;
  onClose: () => void;
  onSuccess: () => void;
}

export const MovementEditModal: React.FC<MovementEditModalProps> = ({ 
  movement, 
  onClose, 
  onSuccess 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [movementDate, setMovementDate] = useState<Date>(new Date(movement.movement_date));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    quantity: movement.quantity.toString(),
    unit_cost: movement.unit_cost?.toString() || '',
    total_cost: movement.total_cost?.toString() || '',
    reference_document: movement.reference_document || '',
    batch_number: movement.batch_number || '',
    expiration_date: movement.expiration_date || '',
    supplier_id: movement.supplier_id || 'none',
    reason: movement.reason || '',
    observations: movement.observations || '',
  });

  console.log('Movement data:', movement);
  console.log('Initial form data:', formData);

  const { data: locations = [] } = useInventoryLocations();
  const { data: suppliers = [] } = useInventorySuppliers();
  const updateMovement = useUpdateInventoryMovement();

  // Reset form data when movement changes
  useEffect(() => {
    setFormData({
      quantity: movement.quantity.toString(),
      unit_cost: movement.unit_cost?.toString() || '',
      total_cost: movement.total_cost?.toString() || '',
      reference_document: movement.reference_document || '',
      batch_number: movement.batch_number || '',
      expiration_date: movement.expiration_date || '',
      supplier_id: movement.supplier_id || 'none',
      reason: movement.reason || '',
      observations: movement.observations || '',
    });
    setMovementDate(new Date(movement.movement_date));
    setErrors({});
  }, [movement]);

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'quantity':
        const qty = parseFloat(value);
        if (!qty || qty <= 0) return 'La cantidad debe ser mayor a 0';
        break;
      case 'unit_cost':
        if (value && parseFloat(value) < 0) return 'El costo no puede ser negativo';
        break;
      case 'total_cost':
        if (value && parseFloat(value) < 0) return 'El costo total no puede ser negativo';
        break;
    }
    return '';
  };

  const handleInputChange = (field: string, value: string) => {
    console.log('Input change:', field, value);
    
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    setErrors(prev => ({ ...prev, [field]: '' }));
    
    // Validate field
    const error = validateField(field, value);
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    }
    
    // Auto-calculate total cost when quantity or unit cost changes
    if (field === 'quantity' || field === 'unit_cost') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(formData.quantity) || 0;
      const unitCost = field === 'unit_cost' ? parseFloat(value) || 0 : parseFloat(formData.unit_cost) || 0;
      
      if (quantity > 0 && unitCost > 0) {
        const totalCost = quantity * unitCost;
        setFormData(prev => ({ ...prev, total_cost: totalCost.toFixed(2) }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate all fields
      const newErrors: Record<string, string> = {};
      const quantity = parseFloat(formData.quantity);
      
      if (!quantity || quantity <= 0) {
        newErrors.quantity = 'La cantidad debe ser mayor a 0';
      }

      if (formData.unit_cost && parseFloat(formData.unit_cost) < 0) {
        newErrors.unit_cost = 'El costo unitario no puede ser negativo';
      }

      if (formData.total_cost && parseFloat(formData.total_cost) < 0) {
        newErrors.total_cost = 'El costo total no puede ser negativo';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        toast.error('Por favor corrige los errores en el formulario');
        return;
      }

      const updateData: Partial<InventoryMovement> = {
        quantity,
        unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
        total_cost: formData.total_cost ? parseFloat(formData.total_cost) : null,
        reference_document: formData.reference_document || null,
        batch_number: formData.batch_number || null,
        expiration_date: formData.expiration_date || null,
        supplier_id: formData.supplier_id === 'none' ? null : formData.supplier_id,
        reason: formData.reason || null,
        observations: formData.observations || null,
        movement_date: movementDate.toISOString(),
      };

      console.log('Updating movement with data:', updateData);
      
      await updateMovement.mutateAsync({ id: movement.id, updates: updateData });
      
      toast.success('Movimiento actualizado correctamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating movement:', error);
      toast.error('Error al actualizar el movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="w-6 h-6 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Editar Movimiento</h3>
          <p className="text-sm text-muted-foreground">
            {movement.item?.name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Información Básica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="movement_date">Fecha del Movimiento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !movementDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {movementDate ? format(movementDate, "dd 'de' MMMM 'de' yyyy", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={movementDate}
                      onSelect={(date) => date && setMovementDate(date)}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity" className="flex items-center gap-1">
                  Cantidad
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  min="0"
                  step="0.01"
                  required
                  disabled={isSubmitting}
                  className={cn(errors.quantity && "border-destructive")}
                />
                {errors.quantity && (
                  <div className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {errors.quantity}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference_document">Documento de Referencia</Label>
                <Input
                  id="reference_document"
                  value={formData.reference_document}
                  onChange={(e) => handleInputChange('reference_document', e.target.value)}
                  placeholder="Número de documento, factura, etc."
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch_number">Lote/Serie</Label>
                <Input
                  id="batch_number"
                  value={formData.batch_number}
                  onChange={(e) => handleInputChange('batch_number', e.target.value)}
                  placeholder="Número de lote o serie"
                  disabled={isSubmitting}
                />
              </div>

              {movement.item?.has_expiration && (
                <div className="space-y-2">
                  <Label htmlFor="expiration_date">Fecha de Vencimiento</Label>
                  <Input
                    id="expiration_date"
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => handleInputChange('expiration_date', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Información de Costos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="unit_cost">Costo Unitario</Label>
                <Input
                  id="unit_cost"
                  type="number"
                  value={formData.unit_cost}
                  onChange={(e) => handleInputChange('unit_cost', e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  disabled={isSubmitting}
                  className={cn(errors.unit_cost && "border-destructive")}
                />
                {errors.unit_cost && (
                  <div className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {errors.unit_cost}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_cost">Costo Total</Label>
                <Input
                  id="total_cost"
                  type="number"
                  value={formData.total_cost}
                  onChange={(e) => handleInputChange('total_cost', e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  disabled={isSubmitting}
                  className={cn(errors.total_cost && "border-destructive")}
                />
                {errors.total_cost && (
                  <div className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {errors.total_cost}
                  </div>
                )}
              </div>

              {movement.movement_type === 'entry' && (
                <div className="space-y-2">
                  <Label htmlFor="supplier_id">Proveedor</Label>
                  <Select 
                    value={formData.supplier_id} 
                    onValueChange={(value) => handleInputChange('supplier_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo</Label>
                <Input
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder="Motivo del movimiento"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observaciones</Label>
                <Textarea
                  id="observations"
                  value={formData.observations}
                  onChange={(e) => handleInputChange('observations', e.target.value)}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
};
