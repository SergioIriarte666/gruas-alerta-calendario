import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import DatePickerInput from '@/components/common/DatePickerInput';
import { ServiceClosure } from '@/types';
import { useClients } from '@/hooks/useClients';
import { useEditClosure } from '@/hooks/closures/useEditClosure';
import EnhancedServicesSelector from './EnhancedServicesSelector';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';
import { toTitleCase } from '@/lib/utils';

const editClosureSchema = z.object({
  dateFrom: z.string().min(1, 'Fecha de inicio es requerida'),
  dateTo: z.string().min(1, 'Fecha de fin es requerida'),
  clientId: z.string().optional(),
  status: z.enum(['open', 'closed', 'invoiced', 'quoted', 'purchase_order_pending'] as const)
});

type EditClosureFormData = z.infer<typeof editClosureSchema>;

interface EditClosureFormProps {
  closure: ServiceClosure;
  onSubmit: (data: EditClosureFormData) => void;
  onCancel: () => void;
}

export const EditClosureForm: React.FC<EditClosureFormProps> = ({
  closure,
  onSubmit,
  onCancel
}) => {
  const { clients } = useClients();
  const [localClosure, setLocalClosure] = useState<ServiceClosure>(closure);
  
  const {
    availableServices,
    currentServices,
    pendingServices,
    loading: servicesLoading,
    selectedServiceIds,
    updateClosureServices,
    completeService,
    completeMultipleServices
  } = useEditClosure({
    closure: localClosure,
    onUpdate: (updates) => {
      setLocalClosure(prev => ({ ...prev, ...updates }));
    }
  });
  
  const {
    register: _register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<EditClosureFormData>({
    resolver: zodResolver(editClosureSchema),
    defaultValues: {
      dateFrom: closure.dateRange.from,
      dateTo: closure.dateRange.to,
      clientId: closure.clientId || '',
      status: closure.status
    }
  });

  // ✅ MANEJADOR CORREGIDO PARA CLIENTE
  const handleClientChange = (value: string) => {
    if (value === "all") {
      setValue('clientId', ''); // Convertir "all" a string vacío para el formulario
    } else {
      setValue('clientId', value);
    }
  };

  // ✅ FUNCIÓN PARA OBTENER EL VALOR CORRECTO DEL SELECT
  const getClientDisplayValue = () => {
    const currentClientId = watch('clientId');
    if (!currentClientId || currentClientId === '') return 'all';
    return currentClientId;
  };

  const handleFormSubmit = (data: EditClosureFormData) => {
    // Update the closure with form data
    const updatedClosure = {
      ...localClosure,
      dateRange: {
        from: data.dateFrom,
        to: data.dateTo
      },
      clientId: data.clientId || undefined,
      status: data.status
    };
    setLocalClosure(updatedClosure);
    onSubmit(data);
  };

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    const newServiceIds = checked 
      ? [...selectedServiceIds, serviceId]
      : selectedServiceIds.filter(id => id !== serviceId);
    
    updateClosureServices(newServiceIds);
  };

  const handleRemoveCurrentService = (serviceId: string) => {
    const newServiceIds = selectedServiceIds.filter(id => id !== serviceId);
    updateClosureServices(newServiceIds);
  };

  const activeClients = clients.filter(c => c.isActive);

  return (
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground">
          Editar Cierre {closure.folio}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateFrom" className="text-foreground">Fecha de Inicio</Label>
              <DatePickerInput
                id="dateFrom"
                value={watch('dateFrom') || ''}
                onChange={(value) => setValue('dateFrom', value)}
                placeholder="Seleccionar fecha"
                className="mt-1"
              />
              {errors.dateFrom && (
                <p className="text-sm text-destructive mt-1">{errors.dateFrom.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="dateTo" className="text-foreground">Fecha de Fin</Label>
              <DatePickerInput
                id="dateTo"
                value={watch('dateTo') || ''}
                onChange={(value) => setValue('dateTo', value)}
                placeholder="Seleccionar fecha"
                className="mt-1"
              />
              {errors.dateTo && (
                <p className="text-sm text-destructive mt-1">{errors.dateTo.message}</p>
              )}
            </div>

            {/* SELECT DE CLIENTE - TOTALMENTE CORREGIDO */}
            <div>
              <Label htmlFor="clientId" className="text-foreground">Cliente</Label>
              <Select 
                value={getClientDisplayValue()} 
                onValueChange={handleClientChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {/* ✅ CORREGIDO: Cambié value="" por value="all" */}
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {toTitleCase(client.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status" className="text-foreground">Estado</Label>
              <Select value={watch('status')} onValueChange={(value) => setValue('status', value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                  <SelectItem value="invoiced">Facturado</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-destructive mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Current Services Section */}
          {currentServices.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-foreground">Servicios Actuales en el Cierre</Label>
                <div className="text-sm text-muted-foreground">
                  {currentServices.length} servicio{currentServices.length !== 1 ? 's' : ''} • Total: ${localClosure.total.toLocaleString()}
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-muted">
                <div className="space-y-1">
                  {currentServices.map(service => (
                    <div key={service.id} className="flex items-center justify-between py-2 px-2 rounded bg-primary/10 border border-primary/30">
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-foreground">{service.folio} - {toTitleCase(service.client.name)}</span>
                          <span className="font-medium text-primary">${getServiceValueForClosure(service).toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {service.serviceDate} • {service.licensePlate}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveCurrentService(service.id)}
                        className="ml-2 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Services Selector for Adding New Services */}
          <div className="space-y-4">
            <Label className="text-foreground">Agregar Servicios al Cierre</Label>
            <EnhancedServicesSelector 
              services={availableServices} 
              pendingServices={pendingServices}
              loading={servicesLoading} 
              clientId={watch('clientId') || ''} 
              selectedServiceIds={[]} // Don't pre-select any from available
              onServiceToggle={handleServiceToggle}
              onCompleteService={completeService}
              onCompleteMultipleServices={completeMultipleServices}
              totalCompleted={availableServices.length + currentServices.length}
              usedServiceIds={new Set()}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Actualizar Cierre
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
