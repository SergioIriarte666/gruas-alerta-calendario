import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { portalRequestServiceSchema, PortalRequestServiceSchema } from '@/schemas/portalRequestServiceSchema';
import { useServiceRequest } from '@/hooks/portal/useServiceRequest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const PortalRequestService = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<PortalRequestServiceSchema>({
    resolver: zodResolver(portalRequestServiceSchema),
  });
  const { mutate: requestService, isPending } = useServiceRequest();

  const onSubmit = (data: PortalRequestServiceSchema) => {
    requestService(data);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Solicitar Nuevo Servicio</h1>
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Detalles de la Solicitud</CardTitle>
          <CardDescription className="text-gray-400">
            Complete el formulario para solicitar un nuevo servicio de grúa. Nos pondremos en contacto a la brevedad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Columna Izquierda */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="origin" className="text-gray-300">Origen</Label>
                <Input id="origin" {...register('origin')} className="bg-gray-700 border-gray-600 text-white" />
                {errors.origin && <p className="text-red-500 text-sm mt-1">{errors.origin.message}</p>}
              </div>
              <div>
                <Label htmlFor="destination" className="text-gray-300">Destino</Label>
                <Input id="destination" {...register('destination')} className="bg-gray-700 border-gray-600 text-white" />
                {errors.destination && <p className="text-red-500 text-sm mt-1">{errors.destination.message}</p>}
              </div>
              <div>
                <Label htmlFor="observations" className="text-gray-300">Observaciones</Label>
                <Textarea id="observations" {...register('observations')} className="bg-gray-700 border-gray-600 text-white" />
              </div>
            </div>

            {/* Columna Derecha */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="license_plate" className="text-gray-300">Patente del Vehículo</Label>
                <Input id="license_plate" {...register('license_plate')} className="bg-gray-700 border-gray-600 text-white" />
                {errors.license_plate && <p className="text-red-500 text-sm mt-1">{errors.license_plate.message}</p>}
              </div>
              <div>
                <Label htmlFor="vehicle_brand" className="text-gray-300">Marca del Vehículo</Label>
                <Input id="vehicle_brand" {...register('vehicle_brand')} className="bg-gray-700 border-gray-600 text-white" />
                {errors.vehicle_brand && <p className="text-red-500 text-sm mt-1">{errors.vehicle_brand.message}</p>}
              </div>
              <div>
                <Label htmlFor="vehicle_model" className="text-gray-300">Modelo del Vehículo</Label>
                <Input id="vehicle_model" {...register('vehicle_model')} className="bg-gray-700 border-gray-600 text-white" />
                {errors.vehicle_model && <p className="text-red-500 text-sm mt-1">{errors.vehicle_model.message}</p>}
              </div>
            </div>

            {/* Botón de envío */}
            <div className="md:col-span-2 flex justify-end">
                <Button type="submit" className="bg-tms-green hover:bg-tms-green-dark text-white font-bold" disabled={isPending}>
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


