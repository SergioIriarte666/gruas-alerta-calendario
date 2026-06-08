
import { useState, useEffect } from 'react';
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
import { createLogger } from "@/lib/logger";


const logger = createLogger("PortalRequestService");
const PortalRequestService = () => {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<PortalRequestServiceSchema>({
    resolver: zodResolver(portalRequestServiceSchema),
    defaultValues: {
      urgency: 'normal',
    },
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
    logger.debug('Enviando solicitud con datos:', data);
    requestService(data);
  };

  const isLicensePlateRequired = selectedServiceType?.license_plate_required || false;
  const isVehicleBrandRequired = selectedServiceType?.vehicle_brand_required || false;
  const isVehicleModelRequired = selectedServiceType?.vehicle_model_required || false;
  const showVehicleFields = selectedServiceType && (isLicensePlateRequired || isVehicleBrandRequired || isVehicleModelRequired || selectedServiceType.vehicle_info_optional);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-foreground sm:text-2xl">Solicitar Nuevo Servicio</h1>
      <Card className="bg-white border-[#e2e8f0]">
        <CardHeader>
          <CardTitle className="text-[#0f172a]">Detalles de la Solicitud</CardTitle>
          <CardDescription className="text-[#94a3b8]">
            Complete el formulario para solicitar un nuevo servicio de grúa. Su solicitud será revisada y se asignarán los recursos necesarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Tipo de Servicio */}
            <div>
              <Label htmlFor="service_type_id" className="text-[13px] text-[#374151]">Tipo de Servicio *</Label>
              <Select onValueChange={(value) => setValue('service_type_id', value)} disabled={loadingServiceTypes}>
                <SelectTrigger className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a]">
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
                  <Label htmlFor="origin" className="text-[13px] text-[#374151]">
                    Origen {selectedServiceType?.origin_required && <span className="text-red-500">*</span>}
                    {!selectedServiceType?.origin_required && <span className="text-muted-foreground text-sm">(Opcional)</span>}
                  </Label>
                  <Input id="origin" {...register('origin')} className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:border-violet-400" />
                  {errors.origin && <p className="text-red-500 text-sm mt-1">{errors.origin.message}</p>}
                </div>
                <div>
                  <Label htmlFor="destination" className="text-[13px] text-[#374151]">
                    Destino {selectedServiceType?.destination_required && <span className="text-red-500">*</span>}
                    {!selectedServiceType?.destination_required && <span className="text-muted-foreground text-sm">(Opcional)</span>}
                  </Label>
                  <Input id="destination" {...register('destination')} className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:border-violet-400" />
                  {errors.destination && <p className="text-red-500 text-sm mt-1">{errors.destination.message}</p>}
                </div>
                <div>
                  <Label htmlFor="service_date" className="text-[13px] text-[#374151]">Fecha de Servicio *</Label>
                  <DatePickerInput
                    id="service_date"
                    value={watch('service_date') || ''}
                    onChange={(value) => setValue('service_date', value)}
                    placeholder="Seleccionar fecha"
                    className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a]"
                  />
                  {errors.service_date && <p className="text-red-500 text-sm mt-1">{errors.service_date.message}</p>}
                </div>
                <div>
                  <Label htmlFor="observations" className="text-[13px] text-[#374151]">Observaciones</Label>
                  <Textarea id="observations" {...register('observations')} className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:border-violet-400" />
                </div>
                <div>
                  <Label className="text-[13px] text-[#374151]">Urgencia</Label>
                  <div className="mt-1 flex gap-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="radio" value="normal" {...register('urgency')} defaultChecked />
                      <span className="text-sm text-[#374151]">Normal</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="radio" value="urgent" {...register('urgency')} />
                      <span className="text-sm text-red-400">Urgente</span>
                    </label>
                  </div>
                </div>
                <div>
                  <Label htmlFor="preferred_time" className="text-[13px] text-[#374151]">
                    Hora preferida <span className="text-muted-foreground text-sm">(Opcional)</span>
                  </Label>
                  <Input
                    id="preferred_time"
                    type="time"
                    {...register('preferred_time')}
                    className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:border-violet-400"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone" className="text-[13px] text-[#374151]">
                    Telefono de contacto <span className="text-muted-foreground text-sm">(Opcional)</span>
                  </Label>
                  <Input
                    id="contact_phone"
                    {...register('contact_phone')}
                    placeholder="Ej: +56 9 1234 5678"
                    className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:border-violet-400"
                  />
                  {errors.contact_phone && <p className="text-red-500 text-sm mt-1">{errors.contact_phone.message}</p>}
                </div>
              </div>

              {/* Columna Derecha - Información del Vehículo */}
              <div className="space-y-4">
                {selectedServiceType && (!isLicensePlateRequired && !isVehicleBrandRequired && !isVehicleModelRequired) && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm text-blue-700">
                      ℹ️ Para este tipo de servicio, toda la información del vehículo es opcional.
                    </p>
                  </div>
                )}
                
                {showVehicleFields && (
                  <>
                    <div>
                      <Label htmlFor="license_plate" className="text-[13px] text-[#374151]">
                        Patente del Vehículo {isLicensePlateRequired && <span className="text-red-500">*</span>}
                      </Label>
                      <Input 
                        id="license_plate" 
                        {...register('license_plate')} 
                        className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:border-violet-400" 
                        placeholder="Ej: AB-CD-12"
                      />
                      {errors.license_plate && <p className="text-red-500 text-sm mt-1">{errors.license_plate.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="vehicle_brand" className="text-[13px] text-[#374151]">
                        Marca del Vehículo {isVehicleBrandRequired && <span className="text-red-500">*</span>}
                      </Label>
                      <Input 
                        id="vehicle_brand" 
                        {...register('vehicle_brand')} 
                        className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:border-violet-400" 
                        placeholder="Ej: Toyota"
                      />
                      {errors.vehicle_brand && <p className="text-red-500 text-sm mt-1">{errors.vehicle_brand.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="vehicle_model" className="text-[13px] text-[#374151]">
                        Modelo del Vehículo {isVehicleModelRequired && <span className="text-red-500">*</span>}
                      </Label>
                      <Input 
                        id="vehicle_model" 
                        {...register('vehicle_model')} 
                        className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:border-violet-400" 
                        placeholder="Ej: Corolla"
                      />
                      {errors.vehicle_model && <p className="text-red-500 text-sm mt-1">{errors.vehicle_model.message}</p>}
                    </div>
                  </>
                )}

                {selectedServiceType && !showVehicleFields && (
                  <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-4 text-center">
                    <p className="text-sm text-[#94a3b8]">
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
                className="bg-violet-700 hover:bg-violet-800 text-white font-medium" 
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
