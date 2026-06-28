import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ServiceTypeConfig, ServiceTypeFormData } from '@/types/serviceTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SERVICE_CATEGORY_OPTIONS, type ServiceCategory } from '@/utils/serviceCategoryLabels';

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
  isOutsourced: false,
  serviceCategory: 'traslado',
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
        isOutsourced: serviceType.isOutsourced || false,
        serviceCategory: serviceType.serviceCategory || 'traslado',
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
    <div className="h-full max-h-[80vh] flex flex-col">
      <ScrollArea className="flex-1 pr-4">
        <form id="service-type-form" onSubmit={handleSubmit} className="space-y-6 pb-4">
          <Card className="bg-card border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground text-lg">Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-muted-foreground text-sm font-medium">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-muted-foreground text-sm font-medium">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="focus:border-primary resize-none"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="basePrice" className="text-muted-foreground text-sm font-medium">Precio Base (CLP)</Label>
                <Input
                  id="basePrice"
                  type="number"
                  min="0"
                  value={formData.basePrice}
                  onChange={(e) => updateField('basePrice', parseFloat(e.target.value) || 0)}
                  className="focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-x-3 py-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => updateField('isActive', checked)}
                />
                <Label htmlFor="isActive" className="text-muted-foreground text-sm">Tipo de servicio activo</Label>
              </div>

              <div className="flex items-center justify-between gap-4 py-2">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="vehicleInfoOptional" className="text-foreground text-sm font-medium cursor-pointer">
                    Información del vehículo opcional
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Activar para servicios donde los datos del vehículo (marca, modelo, patente) no son obligatorios.
                    Ej: Trámites Administrativos, Carga de Combustible.
                  </p>
                </div>
                <Switch
                  id="vehicleInfoOptional"
                  checked={formData.vehicleInfoOptional}
                  onCheckedChange={(checked) => updateField('vehicleInfoOptional', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground text-lg">Categoría Operacional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm font-medium">
                  Categoría del servicio
                </Label>
                <Select
                  value={formData.serviceCategory}
                  onValueChange={(value: ServiceCategory) => updateField('serviceCategory', value)}
                >
                  <SelectTrigger className="focus:border-primary">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define el flujo de inspección del servicio. Cambia el comportamiento del portal
                  operador y del PDF de inspección.
                </p>
              </div>

              {formData.serviceCategory === 'externo_tercero' && (
                <div className="flex items-start gap-3 rounded-md border border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800 p-3 text-sm">
                  <div className="text-purple-700 dark:text-purple-300">
                    <p className="font-medium">Servicio ejecutado por proveedor externo</p>
                    <p className="text-xs mt-1 opacity-90">
                      Al crear servicios de este tipo se solicitarán automáticamente
                      los datos del proveedor subcontratado y el costo asociado.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground text-lg">Configuración de Campos Requeridos</CardTitle>
              <p className="text-muted-foreground text-sm">
                Selecciona qué campos serán obligatorios en el formulario de servicios
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-x-3">
                  <Switch
                    id="purchaseOrderRequired"
                    checked={formData.purchaseOrderRequired}
                    onCheckedChange={(checked) => updateField('purchaseOrderRequired', checked)}
                  />
                  <Label htmlFor="purchaseOrderRequired" className="text-muted-foreground text-sm">
                    Orden de Compra
                  </Label>
                </div>

                <div className="flex items-center gap-x-3">
                  <Switch
                    id="originRequired"
                    checked={formData.originRequired}
                    onCheckedChange={(checked) => updateField('originRequired', checked)}
                  />
                  <Label htmlFor="originRequired" className="text-muted-foreground text-sm">
                    Origen
                  </Label>
                </div>

                <div className="flex items-center gap-x-3">
                  <Switch
                    id="destinationRequired"
                    checked={formData.destinationRequired}
                    onCheckedChange={(checked) => updateField('destinationRequired', checked)}
                  />
                  <Label htmlFor="destinationRequired" className="text-muted-foreground text-sm">
                    Destino
                  </Label>
                </div>

                <div className="flex items-center gap-x-3">
                  <Switch
                    id="craneRequired"
                    checked={formData.craneRequired}
                    onCheckedChange={(checked) => updateField('craneRequired', checked)}
                  />
                  <Label htmlFor="craneRequired" className="text-muted-foreground text-sm">
                    Grúa
                  </Label>
                </div>

                <div className="flex items-center gap-x-3">
                  <Switch
                    id="operatorRequired"
                    checked={formData.operatorRequired}
                    onCheckedChange={(checked) => updateField('operatorRequired', checked)}
                  />
                  <Label htmlFor="operatorRequired" className="text-muted-foreground text-sm">
                    Operador
                  </Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-foreground font-medium text-sm">Información del Vehículo</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-x-3">
                    <Switch
                      id="vehicleBrandRequired"
                      checked={formData.vehicleBrandRequired}
                      onCheckedChange={(checked) => updateField('vehicleBrandRequired', checked)}
                    />
                    <Label htmlFor="vehicleBrandRequired" className="text-muted-foreground text-sm">
                      Marca
                    </Label>
                  </div>

                  <div className="flex items-center gap-x-3">
                    <Switch
                      id="vehicleModelRequired"
                      checked={formData.vehicleModelRequired}
                      onCheckedChange={(checked) => updateField('vehicleModelRequired', checked)}
                    />
                    <Label htmlFor="vehicleModelRequired" className="text-muted-foreground text-sm">
                      Modelo
                    </Label>
                  </div>

                  <div className="flex items-center gap-x-3">
                    <Switch
                      id="licensePlateRequired"
                      checked={formData.licensePlateRequired}
                      onCheckedChange={(checked) => updateField('licensePlateRequired', checked)}
                    />
                    <Label htmlFor="licensePlateRequired" className="text-muted-foreground text-sm">
                      Patente
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </ScrollArea>
      
      <div className="flex gap-4 pt-4 border-t bg-card">
        <Button
          type="submit"
          form="service-type-form"
          disabled={isSubmitting}
          className="flex-1 bg-primary hover:bg-primary/80 text-primary-foreground font-medium"
        >
          {isSubmitting ? 'Guardando...' : serviceType ? 'Actualizar' : 'Crear'} Tipo de Servicio
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
};
