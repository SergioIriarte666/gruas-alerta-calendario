
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ServiceTypeConfig, ServiceTypeFormData } from '@/types/serviceTypes';

interface ServiceTypeFormProps {
  serviceType?: ServiceTypeConfig | null;
  onSubmit: (data: ServiceTypeFormData) => Promise<void>;
  onCancel: () => void;
}

const defaultFormData: ServiceTypeFormData = {
  name: '',
  description: '',
  basePrice: 0,
  isActive: true,
  vehicleInfoOptional: false,
  purchaseOrderRequired: false,
  originRequired: true,
  destinationRequired: true,
  craneRequired: true,
  operatorRequired: true,
  vehicleBrandRequired: true,
  vehicleModelRequired: true,
  licensePlateRequired: true
};

export const ServiceTypeForm = ({ serviceType, onSubmit, onCancel }: ServiceTypeFormProps) => {
  const [formData, setFormData] = useState<ServiceTypeFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (serviceType) {
      setFormData({
        name: serviceType.name,
        description: serviceType.description || '',
        basePrice: serviceType.basePrice || 0,
        isActive: serviceType.isActive,
        vehicleInfoOptional: serviceType.vehicleInfoOptional,
        purchaseOrderRequired: serviceType.purchaseOrderRequired,
        originRequired: serviceType.originRequired,
        destinationRequired: serviceType.destinationRequired,
        craneRequired: serviceType.craneRequired,
        operatorRequired: serviceType.operatorRequired,
        vehicleBrandRequired: serviceType.vehicleBrandRequired,
        vehicleModelRequired: serviceType.vehicleModelRequired,
        licensePlateRequired: serviceType.licensePlateRequired
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [serviceType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof ServiceTypeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-gray-300">Nombre</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
              required
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-gray-300">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="basePrice" className="text-gray-300">Precio Base (CLP)</Label>
            <Input
              id="basePrice"
              type="number"
              min="0"
              value={formData.basePrice}
              onChange={(e) => updateField('basePrice', parseFloat(e.target.value) || 0)}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => updateField('isActive', checked)}
            />
            <Label htmlFor="isActive" className="text-gray-300">Tipo de servicio activo</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="vehicleInfoOptional"
              checked={formData.vehicleInfoOptional}
              onCheckedChange={(checked) => updateField('vehicleInfoOptional', checked)}
            />
            <Label htmlFor="vehicleInfoOptional" className="text-gray-300">
              Información de vehículo opcional (campo legacy)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Configuración de Campos Requeridos</CardTitle>
          <p className="text-gray-400 text-sm">
            Selecciona qué campos serán obligatorios en el formulario de servicios
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="purchaseOrderRequired"
                checked={formData.purchaseOrderRequired}
                onCheckedChange={(checked) => updateField('purchaseOrderRequired', checked)}
              />
              <Label htmlFor="purchaseOrderRequired" className="text-gray-300">
                Orden de Compra
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="originRequired"
                checked={formData.originRequired}
                onCheckedChange={(checked) => updateField('originRequired', checked)}
              />
              <Label htmlFor="originRequired" className="text-gray-300">
                Origen
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="destinationRequired"
                checked={formData.destinationRequired}
                onCheckedChange={(checked) => updateField('destinationRequired', checked)}
              />
              <Label htmlFor="destinationRequired" className="text-gray-300">
                Destino
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="craneRequired"
                checked={formData.craneRequired}
                onCheckedChange={(checked) => updateField('craneRequired', checked)}
              />
              <Label htmlFor="craneRequired" className="text-gray-300">
                Grúa
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="operatorRequired"
                checked={formData.operatorRequired}
                onCheckedChange={(checked) => updateField('operatorRequired', checked)}
              />
              <Label htmlFor="operatorRequired" className="text-gray-300">
                Operador
              </Label>
            </div>
          </div>

          <Separator className="bg-gray-600" />

          <div>
            <h4 className="text-white font-medium mb-3">Información del Vehículo</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="vehicleBrandRequired"
                  checked={formData.vehicleBrandRequired}
                  onCheckedChange={(checked) => updateField('vehicleBrandRequired', checked)}
                />
                <Label htmlFor="vehicleBrandRequired" className="text-gray-300">
                  Marca
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="vehicleModelRequired"
                  checked={formData.vehicleModelRequired}
                  onCheckedChange={(checked) => updateField('vehicleModelRequired', checked)}
                />
                <Label htmlFor="vehicleModelRequired" className="text-gray-300">
                  Modelo
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="licensePlateRequired"
                  checked={formData.licensePlateRequired}
                  onCheckedChange={(checked) => updateField('licensePlateRequired', checked)}
                />
                <Label htmlFor="licensePlateRequired" className="text-gray-300">
                  Patente
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? 'Guardando...' : serviceType ? 'Actualizar' : 'Crear'} Tipo de Servicio
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};
