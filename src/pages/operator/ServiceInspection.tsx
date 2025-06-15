
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOperatorService } from '@/hooks/useOperatorService';
import { inspectionFormSchema, InspectionFormValues } from '@/schemas/inspectionSchema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VehicleEquipmentChecklist } from '@/components/operator/VehicleEquipmentChecklist';
import { ArrowLeft, User, Signature } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const ServiceInspection = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: service, isLoading, error } = useOperatorService(id!);

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      equipment: [],
      vehicleObservations: '',
      operatorSignature: '',
      clientSignature: '',
      clientName: '',
      clientRut: '',
    },
  });

  const updateServiceStatusMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from('services')
        .update({ status: 'in_progress' })
        .eq('id', serviceId);

      if (error) throw new Error('Error al actualizar el estado del servicio');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorServices'] });
      queryClient.invalidateQueries({ queryKey: ['operatorService', id] });
      toast.success('Servicio iniciado con éxito');
      navigate('/operator');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const onSubmit = (values: InspectionFormValues) => {
    console.log('Inspection data:', values);
    // TODO: Save inspection data to a new table 'inspections'
    if (id) {
      updateServiceStatusMutation.mutate(id);
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/4" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="text-center text-red-400">
        Error al cargar el servicio. Por favor, intenta de nuevo.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white">
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold text-tms-green">Inspección Pre-Servicio</h1>
      </header>

      <Card className="bg-slate-800 border-slate-700 text-white">
        <CardHeader>
          <CardTitle className="text-xl">Detalles del Servicio (Folio: {service.folio})</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
          <p><strong className="text-gray-400">Cliente:</strong> {service.client.name}</p>
          <p><strong className="text-gray-400">Tipo:</strong> {service.serviceType.name}</p>
          <p><strong className="text-gray-400">Origen:</strong> {service.origin}</p>
          <p><strong className="text-gray-400">Destino:</strong> {service.destination}</p>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <VehicleEquipmentChecklist form={form} />
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader><CardTitle>Observaciones y Firmas</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="vehicleObservations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones del vehículo del cliente</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Añade cualquier observación sobre el estado del vehículo..." {...field} className="bg-slate-900 border-slate-600 focus:border-tms-green"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="operatorSignature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><Signature className="w-4 h-4" /> Firma del Operador (Tu Nombre)</FormLabel>
                      <FormControl>
                        <Input placeholder="Escribe tu nombre completo" {...field} className="bg-slate-900 border-slate-600 focus:border-tms-green"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><User className="w-4 h-4" /> Nombre del Cliente (si está presente)</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de quien recibe" {...field} className="bg-slate-900 border-slate-600 focus:border-tms-green" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" className="bg-tms-green hover:bg-tms-green/90 text-slate-900 font-bold" disabled={updateServiceStatusMutation.isPending}>
              {updateServiceStatusMutation.isPending ? 'Iniciando...' : 'Iniciar Servicio'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ServiceInspection;
