
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { portalRequestServiceSchema, PortalRequestServiceSchema } from '@/schemas/portalRequestServiceSchema';
import { useServiceRequest } from '@/hooks/portal/useServiceRequest';
import { useServiceTypesForPortal } from '@/hooks/portal/useServiceTypesForPortal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';

const PortalRequestService = () => {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<PortalRequestServiceSchema>({
    resolver: zodResolver(portalRequestServiceSchema),
  });
  const { mutate: requestService, isPending } = useServiceRequest();
  const { serviceTypes, loading: loadingServiceTypes } = useServiceTypesForPortal();
  
  const selectedServiceTypeId = watch('service_type_id');
  const [selectedServiceType, setSelectedServiceType] = useState<any>(null);

  // Actualizar el tipo de servicio seleccionado cuando cambia
  useEffect(() => {
    if (selectedServiceTypeId && serviceTypes.length > 0) {
      const serviceType = serviceTypes.find(st => st.id === selectedServiceTypeId);
      setSelectedServiceType(serviceType);
    } else {
      setSelectedServiceType(null);
    }
  }, [selectedServiceTypeId, serviceTypes]);

  const onSubmit = (data: PortalRequestServiceSchema) => {
    console.log('Enviando solicitud con datos:', data);
    requestService(data);
  };

  const isLicensePlateRequired = selectedServiceType?.license_plate_required || false;
  const isVehicleBrandRequired = selectedServiceType?.vehicle_brand_required || false;
  const isVehicleModelRequired = selectedServiceType?.vehicle_model_required || false;
  const showVehicleFields = selectedServiceType && (isLicensePlateRequired || isVehicleBrandRequired || isVehicleModelRequired || selectedServiceType.vehicle_info_optional);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Solicitar Nuevo Servicio</h1>
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Detalles de la Solicitud</CardTitle>
          <CardDescription className="text-gray-400">
            Complete el formulario para solicitar un nuevo servicio de grúa. Su solicitud será revisada y se asignarán los recursos necesarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Tipo de Servicio */}
            <div>
              <Label htmlFor="service_type_id" className="text-gray-300">Tipo de Servicio *</Label>
              <Select onValueChange={(value) => setValue('service_type_id', value)} disabled={loadingServiceTypes}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder={loadingServiceTypes ? "Cargando..." : "Selecciona un tipo de servicio"} />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((serviceType) => (
                    <SelectItem key={serviceType.id} value={serviceType.id}>
                      {serviceType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.service_type_id && <p className="text-red-500 text-sm mt-1">{errors.service_type_id.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Columna Izquierda */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="origin" className="text-gray-300">
                    Origen {selectedServiceType?.origin_required && <span className="text-red-500">*</span>}
                    {!selectedServiceType?.origin_required && <span className="text-muted-foreground text-sm">(Opcional)</span>}
                  </Label>
                  <Input id="origin" {...register('origin')} className="bg-gray-700 border-gray-600 text-white" />
                  {errors.origin && <p className="text-red-500 text-sm mt-1">{errors.origin.message}</p>}
                </div>
                <div>
                  <Label htmlFor="destination" className="text-gray-300">
                    Destino {selectedServiceType?.destination_required && <span className="text-red-500">*</span>}
                    {!selectedServiceType?.destination_required && <span className="text-muted-foreground text-sm">(Opcional)</span>}
                  </Label>
                  <Input id="destination" {...register('destination')} className="bg-gray-700 border-gray-600 text-white" />
                  {errors.destination && <p className="text-red-500 text-sm mt-1">{errors.destination.message}</p>}
                </div>
                <div>
                  <Label htmlFor="service_date" className="text-gray-300">Fecha de Servicio *</Label>
                  <DatePickerInput
                    id="service_date"
                    value={watch('service_date') || ''}
                    onChange={(value) => setValue('service_date', value)}
                    placeholder="Seleccionar fecha"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  {errors.service_date && <p className="text-red-500 text-sm mt-1">{errors.service_date.message}</p>}
                </div>
                <div>
                  <Label htmlFor="observations" className="text-gray-300">Observaciones</Label>
                  <Textarea id="observations" {...register('observations')} className="bg-gray-700 border-gray-600 text-white" />
                </div>
              </div>

              {/* Columna Derecha - Información del Vehículo */}
              <div className="space-y-4">
                {selectedServiceType && (!isLicensePlateRequired && !isVehicleBrandRequired && !isVehicleModelRequired) && (
                  <div className="bg-blue-900/20 border border-blue-600/30 rounded-md p-3">
                    <p className="text-blue-300 text-sm">
                      ℹ️ Para este tipo de servicio, toda la información del vehículo es opcional.
                    </p>
                  </div>
                )}
                
                {showVehicleFields && (
                  <>
                    <div>
                      <Label htmlFor="license_plate" className="text-gray-300">
                        Patente del Vehículo {isLicensePlateRequired && <span className="text-red-500">*</span>}
                      </Label>
                      <Input 
                        id="license_plate" 
                        {...register('license_plate')} 
                        className="bg-gray-700 border-gray-600 text-white" 
                        placeholder="Ej: AB-CD-12"
                      />
                      {errors.license_plate && <p className="text-red-500 text-sm mt-1">{errors.license_plate.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="vehicle_brand" className="text-gray-300">
                        Marca del Vehículo {isVehicleBrandRequired && <span className="text-red-500">*</span>}
                      </Label>
                      <Input 
                        id="vehicle_brand" 
                        {...register('vehicle_brand')} 
                        className="bg-gray-700 border-gray-600 text-white" 
                        placeholder="Ej: Toyota"
                      />
                      {errors.vehicle_brand && <p className="text-red-500 text-sm mt-1">{errors.vehicle_brand.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="vehicle_model" className="text-gray-300">
                        Modelo del Vehículo {isVehicleModelRequired && <span className="text-red-500">*</span>}
                      </Label>
                      <Input 
                        id="vehicle_model" 
                        {...register('vehicle_model')} 
                        className="bg-gray-700 border-gray-600 text-white" 
                        placeholder="Ej: Corolla"
                      />
                      {errors.vehicle_model && <p className="text-red-500 text-sm mt-1">{errors.vehicle_model.message}</p>}
                    </div>
                  </>
                )}

                {selectedServiceType && !showVehicleFields && (
                  <div className="bg-gray-700/50 border border-gray-600 rounded-md p-4 text-center">
                    <p className="text-gray-400 text-sm">
                      Este tipo de servicio no requiere información del vehículo.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de envío */}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                className="bg-tms-green hover:bg-tms-green-dark text-white font-bold" 
                disabled={isPending || !selectedServiceTypeId}
              >
                {isPending ? 'Enviando...' : 'Enviar Solicitud'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalRequestService;
