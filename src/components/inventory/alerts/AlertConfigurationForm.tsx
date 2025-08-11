import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { 
  useInventoryItems, 
  useInventoryLocations 
} from '@/hooks/useInventory';
import { 
  useCreateAlert, 
  useUpdateAlert, 
  useInventoryAlerts 
} from '@/hooks/useInventoryAlerts';
import { Package, MapPin, AlertTriangle, Clock, TrendingDown, Bell } from 'lucide-react';

const alertSchema = z.object({
  alert_type: z.string().min(1, 'Tipo de alerta es requerido'),
  item_id: z.string().optional(),
  location_id: z.string().optional(),
  threshold_value: z.number().min(0, 'El valor del umbral debe ser mayor o igual a 0').optional(),
  is_active: z.boolean()
});

type AlertFormData = z.infer<typeof alertSchema>;

interface AlertConfigurationFormProps {
  alertId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AlertConfigurationForm: React.FC<AlertConfigurationFormProps> = ({
  alertId,
  onSuccess,
  onCancel
}) => {
  const [selectedAlertType, setSelectedAlertType] = useState<string>('');
  const { data: items = [] } = useInventoryItems();
  const { data: locations = [] } = useInventoryLocations();
  const { data: alerts = [] } = useInventoryAlerts();
  const createAlert = useCreateAlert();
  const updateAlert = useUpdateAlert();

  const currentAlert = alertId ? alerts.find(a => a.id === alertId) : null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AlertFormData>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      alert_type: '',
      item_id: 'all',
      location_id: 'all',
      threshold_value: 0,
      is_active: true
    }
  });

  useEffect(() => {
    if (currentAlert) {
      reset({
        alert_type: currentAlert.alert_type,
        item_id: currentAlert.item_id || 'all',
        location_id: currentAlert.location_id || 'all',
        threshold_value: currentAlert.threshold_value || 0,
        is_active: currentAlert.is_active
      });
      setSelectedAlertType(currentAlert.alert_type);
    }
  }, [currentAlert, reset]);

  const alertTypes = [
    {
      value: 'low_stock',
      label: 'Stock Bajo',
      description: 'Alerta cuando el stock está por debajo del mínimo',
      icon: <Package className="w-4 h-4" />,
      requiresThreshold: true,
      thresholdLabel: 'Cantidad mínima'
    },
    {
      value: 'expiring_soon',
      label: 'Próximo a Vencer',
      description: 'Alerta cuando productos están próximos a vencer',
      icon: <Clock className="w-4 h-4" />,
      requiresThreshold: true,
      thresholdLabel: 'Días antes del vencimiento'
    },
    {
      value: 'overstock',
      label: 'Sobrestock',
      description: 'Alerta cuando hay exceso de inventario',
      icon: <TrendingDown className="w-4 h-4" />,
      requiresThreshold: true,
      thresholdLabel: 'Cantidad máxima'
    },
    {
      value: 'no_movement',
      label: 'Sin Movimiento',
      description: 'Alerta cuando no hay actividad por mucho tiempo',
      icon: <Bell className="w-4 h-4" />,
      requiresThreshold: true,
      thresholdLabel: 'Días sin movimiento'
    }
  ];

  const selectedType = alertTypes.find(type => type.value === selectedAlertType);

  const onSubmit = async (data: AlertFormData) => {
    try {
      console.log('Form data submitted:', data);
      
      // Validate required fields
      if (!data.alert_type) {
        throw new Error('Debe seleccionar un tipo de alerta');
      }

      const alertData = {
        alert_type: data.alert_type,
        item_id: data.item_id === 'all' ? null : data.item_id,
        location_id: data.location_id === 'all' ? null : data.location_id,
        threshold_value: data.threshold_value || null,
        is_active: data.is_active
      };

      console.log('Processed alert data:', alertData);

      if (alertId) {
        await updateAlert.mutateAsync({ id: alertId, config: alertData });
      } else {
        await createAlert.mutateAsync(alertData);
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving alert:', error);
      // The error will be handled by the mutation's onError callback
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Tipo de Alerta */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Tipo de Alerta</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alertTypes.map((type) => (
            <Card
              key={type.value}
              className={`cursor-pointer transition-all ${
                selectedAlertType === type.value
                  ? 'ring-2 ring-primary border-primary'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => {
                setSelectedAlertType(type.value);
                setValue('alert_type', type.value);
              }}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="text-primary">{type.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{type.label}</h4>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {errors.alert_type && (
          <p className="text-sm text-destructive">{errors.alert_type.message}</p>
        )}
      </div>

      {/* Producto (Opcional) */}
      <div className="space-y-2">
        <Label htmlFor="item_id" className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          Producto (Opcional)
        </Label>
        <Select onValueChange={(value) => setValue('item_id', value)} value={watch('item_id')}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar producto específico o dejar vacío para todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los productos</SelectItem>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} {item.sku && `(${item.sku})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ubicación (Opcional) */}
      <div className="space-y-2">
        <Label htmlFor="location_id" className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Ubicación (Opcional)
        </Label>
        <Select onValueChange={(value) => setValue('location_id', value)} value={watch('location_id')}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar ubicación específica o dejar vacío para todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name} ({location.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Umbral (Condicional) */}
      {selectedType?.requiresThreshold && (
        <div className="space-y-2">
          <Label htmlFor="threshold_value" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {selectedType.thresholdLabel}
          </Label>
          <Input
            id="threshold_value"
            type="number"
            min="0"
            step="0.01"
            {...register('threshold_value', { valueAsNumber: true })}
            placeholder={`Ingresa el valor para ${selectedType.thresholdLabel.toLowerCase()}`}
          />
          {errors.threshold_value && (
            <p className="text-sm text-destructive">{errors.threshold_value.message}</p>
          )}
        </div>
      )}

      {/* Estado Activo */}
      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={watch('is_active')}
          onCheckedChange={(checked) => setValue('is_active', checked)}
        />
        <Label htmlFor="is_active" className="flex items-center gap-2">
          Activar alerta inmediatamente
        </Label>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !selectedAlertType}
          className="flex items-center gap-2"
        >
          {isSubmitting ? 'Guardando...' : alertId ? 'Actualizar Alerta' : 'Crear Alerta'}
        </Button>
      </div>
    </form>
  );
};