
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
import { PhotoCapture } from '@/components/operator/PhotoCapture';
import { ArrowLeft, User, Signature, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { generateInspectionPDF } from '@/utils/inspectionPdfGenerator';

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
      clientName: '',
      clientRut: '',
      photosBeforeService: [],
      photosClientVehicle: [],
      photosEquipmentUsed: [],
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
    },
  });

  const saveInspectionMutation = useMutation({
    mutationFn: async (values: InspectionFormValues) => {
      if (!id || !service?.operator?.id) {
        throw new Error('Faltan datos del servicio o del operador.');
      }
      
      const inspectionData = {
        service_id: id,
        operator_id: service.operator.id,
        equipment_checklist: values.equipment,
        vehicle_observations: values.vehicleObservations,
        operator_signature: values.operatorSignature,
        client_name: values.clientName,
        client_rut: values.clientRut,
        photos_before_service: values.photosBeforeService,
        photos_client_vehicle: values.photosClientVehicle,
        photos_equipment_used: values.photosEquipmentUsed,
      };
      
      const { error } = await supabase.from('inspections').insert(inspectionData);

      if (error) {
        console.error('Error saving inspection:', error);
        throw new Error(`Error al guardar la inspección: ${error.message}`);
      }

      return values;
    },
    onSuccess: async (values) => {
      toast.success('Inspección guardada.');
      
      // Generar y descargar PDF
      try {
        const pdfBlob = await generateInspectionPDF({
          service: service!,
          inspection: values,
        });
        
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Inspeccion-${service!.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success('PDF generado y descargado');
        
        // Limpiar fotos temporales del localStorage
        [...values.photosBeforeService, ...values.photosClientVehicle, ...values.photosEquipmentUsed]
          .forEach(photoName => {
            localStorage.removeItem(`photo-${photoName}`);
          });
        
      } catch (error) {
        console.error('Error generando PDF:', error);
        toast.error('Error al generar el PDF');
      }
      
      if (id) {
        updateServiceStatusMutation.mutate(id);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: InspectionFormValues) => {
    saveInspectionMutation.mutate(values);
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
          
          {/* Sección de Fotografías */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Documentación Fotográfica</h3>
            
            <FormField
              control={form.control}
              name="photosBeforeService"
              render={({ field }) => (
                <PhotoCapture
                  title="Fotos Antes del Servicio"
                  photos={field.value}
                  onPhotosChange={field.onChange}
                />
              )}
            />
            
            <FormField
              control={form.control}
              name="photosClientVehicle"
              render={({ field }) => (
                <PhotoCapture
                  title="Fotos del Vehículo del Cliente"
                  photos={field.value}
                  onPhotosChange={field.onChange}
                />
              )}
            />
            
            <FormField
              control={form.control}
              name="photosEquipmentUsed"
              render={({ field }) => (
                <PhotoCapture
                  title="Fotos del Equipo Utilizado"
                  photos={field.value}
                  onPhotosChange={field.onChange}
                />
              )}
            />
          </div>
          
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
            <Button type="submit" className="bg-tms-green hover:bg-tms-green/90 text-slate-900 font-bold flex items-center gap-2" disabled={saveInspectionMutation.isPending || updateServiceStatusMutation.isPending}>
              <Download className="w-4 h-4" />
              {saveInspectionMutation.isPending ? 'Guardando Inspección...' : updateServiceStatusMutation.isPending ? 'Iniciando Servicio...' : 'Guardar e Iniciar Servicio'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ServiceInspection;
