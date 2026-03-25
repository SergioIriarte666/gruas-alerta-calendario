
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Crane, CraneType } from '@/types';

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
    isActive: true
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
      });
    }
  }, [crane]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string | boolean | CraneType) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const craneTypes = [
    { value: 'light', label: 'Liviana' },
    { value: 'medium', label: 'Mediana' },
    { value: 'heavy', label: 'Pesada' },
    { value: 'taxi', label: 'Taxi' },
    { value: 'horquilla', label: 'Horquilla' },
    { value: 'other', label: 'Otros' }
  ];

  return (
    <DialogContent className="cranes-modal cranes-modal--form sm:max-w-[600px] bg-card border">
      <DialogHeader className="cranes-modal__header bg-gradient-to-r from-violet-600 to-violet-500 text-white -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
        <DialogTitle className="text-white">
          {crane ? 'Editar Grúa' : 'Nueva Grúa'}
        </DialogTitle>
        <DialogDescription className="text-violet-200">
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
              onChange={(e) => handleChange('ownerCompanyRut', e.target.value)}
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
                {craneTypes.map((type) => (
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

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleChange('isActive', checked)}
          />
          <Label htmlFor="isActive" className="text-foreground">
            Grúa Activa
          </Label>
        </div>

        <DialogFooter className="cranes-modal__footer">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {crane ? 'Actualizar' : 'Crear'} Grúa
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
