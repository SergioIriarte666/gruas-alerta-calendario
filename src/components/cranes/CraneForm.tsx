
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    { value: 'other', label: 'Otros' }
  ];

  return (
    <DialogContent className="sm:max-w-[600px] bg-tms-dark border-gray-700">
      <DialogHeader>
        <DialogTitle className="text-white">
          {crane ? 'Editar Grúa' : 'Nueva Grúa'}
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          {crane ? 'Modifica los datos de la grúa' : 'Ingresa los datos de la nueva grúa'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="licensePlate" className="text-gray-300">Patente *</Label>
            <Input
              id="licensePlate"
              value={formData.licensePlate}
              onChange={(e) => handleChange('licensePlate', e.target.value.toUpperCase())}
              placeholder="GRUA-01"
              className="bg-white/5 border-gray-700 text-white"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type" className="text-gray-300">Tipo *</Label>
            <Select value={formData.type} onValueChange={(value) => handleChange('type', value as CraneType)}>
              <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-tms-dark border-gray-700">
                {craneTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-white hover:bg-white/10">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand" className="text-gray-300">Marca *</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => handleChange('brand', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="model" className="text-gray-300">Modelo *</Label>
            <Input
              id="model"
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="circulationPermitExpiry" className="text-gray-300">Venc. Permiso Circulación</Label>
            <Input
              id="circulationPermitExpiry"
              type="date"
              value={formData.circulationPermitExpiry}
              onChange={(e) => handleChange('circulationPermitExpiry', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="insuranceExpiry" className="text-gray-300">Venc. Seguro</Label>
            <Input
              id="insuranceExpiry"
              type="date"
              value={formData.insuranceExpiry}
              onChange={(e) => handleChange('insuranceExpiry', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="technicalReviewExpiry" className="text-gray-300">Venc. Revisión Técnica</Label>
            <Input
              id="technicalReviewExpiry"
              type="date"
              value={formData.technicalReviewExpiry}
              onChange={(e) => handleChange('technicalReviewExpiry', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleChange('isActive', checked)}
          />
          <Label htmlFor="isActive" className="text-gray-300">
            Grúa Activa
          </Label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-gray-700 text-gray-300 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-tms-green hover:bg-tms-green-dark text-white"
          >
            {crane ? 'Actualizar' : 'Crear'} Grúa
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
