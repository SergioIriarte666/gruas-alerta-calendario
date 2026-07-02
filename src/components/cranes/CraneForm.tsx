
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Crane, CraneType, CraneStatus } from '@/types';
import { formatRut } from '@/utils/rutFormatter';
import { CRANE_TYPE_OPTIONS } from '@/utils/craneType';

interface CraneFormProps {
  crane?: Crane;
  onSubmit: (data: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export const CraneForm = ({ crane, onSubmit, onCancel }: CraneFormProps) => {
  const [formData, setFormData] = useState({
    licensePlate: '',
    brand: '',
    model: '',
    type: 'light' as CraneType,
    tollVehicleCategory: 'LIVIANO',
    ownerCompanyName: '',
    ownerCompanyRut: '',
    circulationPermitExpiry: '',
    insuranceExpiry: '',
    technicalReviewExpiry: '',
    isActive: true,
    status: 'active' as CraneStatus,
  });

  useEffect(() => {
    if (crane) {
      setFormData({
        licensePlate: crane.licensePlate || '',
        brand: crane.brand || '',
        model: crane.model || '',
        type: crane.type || 'light',
        tollVehicleCategory: crane.tollVehicleCategory || 'LIVIANO',
        ownerCompanyName: crane.ownerCompanyName || '',
        ownerCompanyRut: crane.ownerCompanyRut || '',
        circulationPermitExpiry: crane.circulationPermitExpiry || '',
        insuranceExpiry: crane.insuranceExpiry || '',
        technicalReviewExpiry: crane.technicalReviewExpiry || '',
        isActive: crane.isActive ?? true,
        status: (crane.status ?? 'active') as CraneStatus,
      });
    } else {
      setFormData({
        licensePlate: '',
        brand: '',
        model: '',
        type: 'light',
        tollVehicleCategory: 'LIVIANO',
        ownerCompanyName: '',
        ownerCompanyRut: '',
        circulationPermitExpiry: '',
        insuranceExpiry: '',
        technicalReviewExpiry: '',
        isActive: true,
        status: 'active' as CraneStatus,
      });
    }
  }, [crane]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string | boolean | CraneType | CraneStatus) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DialogContent className="cranes-modal cranes-modal--form border-border/70 bg-card sm:max-w-[600px]">
      <DialogHeader className="cranes-modal__header -mx-6 -mt-6 rounded-t-lg border-b border-border/70 bg-muted/20 px-6 py-4">
        <DialogTitle className="text-foreground">
          {crane ? 'Editar Grúa' : 'Nueva Grúa'}
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          {crane ? 'Modifica los datos de la grúa' : 'Ingresa los datos de la nueva grúa'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="cranes-modal__form space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="licensePlate" className="text-foreground">Patente *</Label>
            <Input
              id="licensePlate"
              value={formData.licensePlate}
              onChange={(e) => handleChange('licensePlate', e.target.value.toUpperCase())}
              placeholder="GRUA-01"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerCompanyRut" className="text-foreground">Empresa (RUT) *</Label>
            <Input
              id="ownerCompanyRut"
              value={formData.ownerCompanyRut}
              onChange={(e) => handleChange('ownerCompanyRut', formatRut(e.target.value))}
              placeholder="76.123.456-7"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type" className="text-foreground">Tipo *</Label>
            <Select value={formData.type} onValueChange={(value) => handleChange('type', value as CraneType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRANE_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tollVehicleCategory" className="text-foreground">Categoría Peaje</Label>
            <Select value={formData.tollVehicleCategory} onValueChange={(value) => handleChange('tollVehicleCategory', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MOTO">Moto</SelectItem>
                <SelectItem value="LIVIANO">Liviano (Auto / Camioneta)</SelectItem>
                <SelectItem value="LIVIANO_REMOLQUE">Liviano con Remolque</SelectItem>
                <SelectItem value="CAMION_2_EJES">Camión 2 Ejes</SelectItem>
                <SelectItem value="CAMION_PESADO">Camión Pesado</SelectItem>
                <SelectItem value="BUS_2_EJES">Bus 2 Ejes</SelectItem>
                <SelectItem value="BUS_PESADO">Bus Pesado</SelectItem>
                <SelectItem value="SOBREDIMENSIONADO">Sobredimensionado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ownerCompanyName" className="text-foreground">Empresa (Razón Social)</Label>
            <Input
              id="ownerCompanyName"
              value={formData.ownerCompanyName}
              onChange={(e) => handleChange('ownerCompanyName', e.target.value)}
              placeholder="Empresa A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand" className="text-foreground">Marca *</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => handleChange('brand', e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="model" className="text-foreground">Modelo *</Label>
            <Input
              id="model"
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="circulationPermitExpiry" className="text-foreground">Venc. Permiso Circulación</Label>
            <DatePickerInput
              id="circulationPermitExpiry"
              value={formData.circulationPermitExpiry}
              onChange={(value) => handleChange('circulationPermitExpiry', value)}
              placeholder="Seleccionar fecha"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="insuranceExpiry" className="text-foreground">Venc. Seguro</Label>
            <DatePickerInput
              id="insuranceExpiry"
              value={formData.insuranceExpiry}
              onChange={(value) => handleChange('insuranceExpiry', value)}
              placeholder="Seleccionar fecha"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="technicalReviewExpiry" className="text-foreground">Venc. Revisión Técnica</Label>
            <DatePickerInput
              id="technicalReviewExpiry"
              value={formData.technicalReviewExpiry}
              onChange={(value) => handleChange('technicalReviewExpiry', value)}
              placeholder="Seleccionar fecha"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status" className="text-foreground">Estado del equipo</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleChange('status', value as CraneStatus)}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">🟢 Activa — en servicio</SelectItem>
              <SelectItem value="inactive">🟡 Inactiva — fuera de servicio temporal</SelectItem>
              <SelectItem value="sold">🔴 Vendida</SelectItem>
              <SelectItem value="written_off">⚫ Dada de baja</SelectItem>
            </SelectContent>
          </Select>
          {formData.status === 'inactive' && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Este equipo no aparecerá en nuevos servicios.
            </p>
          )}
          {(formData.status === 'sold' || formData.status === 'written_off') && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p className="font-semibold">Este estado aplica un bloqueo permanente.</p>
              <p className="mt-0.5 text-xs text-destructive/80">
                La grúa quedará solo para consulta: no podrá reactivarse ni recibir cambios, servicios, costos, mantenciones o movimientos.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="cranes-modal__footer">
          <Button
            type="button"
            variant="outline"
            className="border-border/70 bg-background/60"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button type="submit">
            {crane ? 'Actualizar' : 'Crear'} Grúa
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
