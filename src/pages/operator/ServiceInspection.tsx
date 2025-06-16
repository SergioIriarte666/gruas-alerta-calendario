
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect } from 'react';
import { useOperatorService } from '@/hooks/useOperatorService';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { inspectionFormSchema, InspectionFormValues } from '@/schemas/inspectionSchema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VehicleEquipmentChecklist } from '@/components/operator/VehicleEquipmentChecklist';
import { PhotoCapture } from '@/components/operator/PhotoCapture';
import { PDFProgress } from '@/components/operator/PDFProgress';
import { ArrowLeft, User, Signature, Download, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPDFGenerator } from '@/utils/enhancedPdfGenerator';

const ServiceInspection = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: service, isLoading, error } = useOperatorService(id!);
  
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStep, setPdfStep] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string>();

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

  const { loadFormData, clearFormData } = useFormPersistence(form, id || '');

  // Cargar datos guardados al montar el componente
  useEffect(() => {
    if (id) {
      const savedData = loadFormData();
      if (savedData) {
        toast.info('Datos del formulario restaurados');
      }
    }
  }, [id, loadFormData]);

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
      
      // Limpiar datos guardados después del éxito
      clearFormData();
      
      toast.success('Servicio iniciado con éxito');
      navigate('/operator');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const processInspectionMutation = useMutation({
    mutationFn: async (values: InspectionFormValues) => {
      if (!service) {
        throw new Error('Faltan datos del servicio.');
      }
      
      setIsGeneratingPDF(true);
      setPdfProgress(0);
      setPdfStep('Iniciando generación...');
      
      const pdfGenerator = createPDFGenerator((progress, step) => {
        setPdfProgress(progress);
        setPdfStep(step);
      });
      
      const { blob, downloadUrl } = await pdfGenerator.generateWithProgress({
        service: service,
        inspection: values,
      });
      
      setPdfDownloadUrl(downloadUrl);
      
      // Intentar descarga automática
      const filename = `Inspeccion-${service.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      const downloadSuccess = await pdfGenerator.downloadPDF(blob, filename, downloadUrl);
      
      if (!downloadSuccess) {
        toast.warning('La descarga automática falló. Usa el botón de descarga manual.');
      }
      
      // Limpiar fotos temporales del localStorage después de la generación exitosa
      [...values.photosBeforeService, ...values.photosClientVehicle, ...values.photosEquipmentUsed]
        .forEach(photoName => {
          localStorage.removeItem(`photo-${photoName}`);
        });
      
      return values;
    },
    onSuccess: () => {
      toast.success('PDF de inspección generado exitosamente');
      
      // Pequeño delay antes de iniciar el servicio para que el usuario vea el PDF
      setTimeout(() => {
        if (id) {
          updateServiceStatusMutation.mutate(id);
        }
      }, 2000);
    },
    onError: (error: Error) => {
      console.error('Error generando PDF:', error);
      toast.error(`Error al generar el PDF: ${error.message}`);
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    },
    onSettled: () => {
      // Reset del estado de generación después de 5 segundos
      setTimeout(() => {
        setIsGeneratingPDF(false);
        setPdfProgress(0);
        setPdfStep('');
        if (pdfDownloadUrl) {
          URL.revokeObjectURL(pdfDownloadUrl);
          setPdfDownloadUrl(undefined);
        }
      }, 5000);
    }
  });

  const handleManualDownload = () => {
    if (pdfDownloadUrl) {
      const link = document.createElement('a');
      link.href = pdfDownloadUrl;
      link.download = `Inspeccion-${service?.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      toast.success('Descarga iniciada');
    }
  };

  const validateFormBeforeSubmit = (values: InspectionFormValues): string[] => {
    const errors: string[] = [];
    
    if (!values.operatorSignature?.trim()) {
      errors.push('La firma del operador es obligatoria');
    }
    
    if (!values.equipment || values.equipment.length === 0) {
      errors.push('Debe seleccionar al menos un elemento del inventario');
    }
    
    const totalPhotos = [
      ...(values.photosBeforeService || []),
      ...(values.photosClientVehicle || []),
      ...(values.photosEquipmentUsed || [])
    ].length;
    
    if (totalPhotos === 0) {
      errors.push('Debe tomar al menos una fotografía');
    }
    
    return errors;
  };

  const onSubmit = (values: InspectionFormValues) => {
    console.log('Datos del formulario:', values);
    
    // Validar antes de procesar
    const validationErrors = validateFormBeforeSubmit(values);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast.error(error));
      return;
    }
    
    processInspectionMutation.mutate(values);
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
    <div className="space-y-6 animate-fade-in relative">
      <PDFProgress 
        isGenerating={isGeneratingPDF}
        progress={pdfProgress}
        currentStep={pdfStep}
        onManualDownload={handleManualDownload}
        downloadUrl={pdfDownloadUrl}
      />

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
            <Button 
              type="submit" 
              className="bg-tms-green hover:bg-tms-green/90 text-slate-900 font-bold flex items-center gap-2" 
              disabled={processInspectionMutation.isPending || updateServiceStatusMutation.isPending || isGeneratingPDF}
            >
              <Download className="w-4 h-4" />
              {isGeneratingPDF ? 'Generando PDF...' : 
               processInspectionMutation.isPending ? 'Procesando...' : 
               updateServiceStatusMutation.isPending ? 'Iniciando Servicio...' : 
               'Generar PDF e Iniciar Servicio'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ServiceInspection;
