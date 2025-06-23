
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useServiceInspection } from '@/hooks/useServiceInspection';
import { inspectionFormSchema, InspectionFormValues } from '@/schemas/inspectionSchema';
import { validateFormBeforeSubmit } from '@/utils/inspectionValidation';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ServiceDetailsCard } from '@/components/operator/ServiceDetailsCard';
import { InspectionFormSections } from '@/components/operator/InspectionFormSections';
import { PDFProgress } from '@/components/operator/PDFProgress';
import { ArrowLeft, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/custom-toast';

const ServiceInspection = () => {
  const {
    id,
    service,
    isLoading,
    error,
    pdfProgress,
    pdfStep,
    isGeneratingPDF,
    pdfDownloadUrl,
    processInspectionMutation,
    updateServiceStatusMutation,
    handleManualDownload,
    handleRetry,
    navigate
  } = useServiceInspection();

  const { toast } = useToast();

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
        toast({ type: 'info', title: 'Datos del formulario restaurados' });
      }
    }
  }, [id, loadFormData, toast]);

  const onSubmit = (values: InspectionFormValues) => {
    console.log('📝 Submitting inspection form:', values);
    
    // Validar antes de procesar
    const validationErrors = validateFormBeforeSubmit(values);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast({ type: 'error', title: error }));
      return;
    }
    
    processInspectionMutation.mutate(values);
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold text-tms-green">Inspección Pre-Servicio</h1>
        </header>
        
        <div className="text-center bg-red-900/20 border border-red-500/30 p-8 rounded-lg">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold mb-2 text-red-400">Error al cargar el servicio</h2>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            {error?.message || 'No se pudo cargar la información del servicio. Por favor, intenta de nuevo.'}
          </p>
          <div className="space-y-3">
            <Button onClick={handleRetry} className="bg-red-600 hover:bg-red-700 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
            <Button onClick={() => navigate(-1)} variant="ghost" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="space-y-6 animate-fade-in">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold text-tms-green">Inspección Pre-Servicio</h1>
        </header>
        
        <div className="text-center bg-yellow-900/20 border border-yellow-500/30 p-8 rounded-lg">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h2 className="text-xl font-semibold mb-2 text-yellow-400">Servicio no encontrado</h2>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            No se encontró información para este servicio. Puede que haya sido eliminado o no tengas acceso a él.
          </p>
          <div className="space-y-3">
            <Button onClick={handleRetry} className="bg-yellow-600 hover:bg-yellow-700 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
            <Button onClick={() => navigate(-1)} variant="outline" className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </div>
        </div>
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

      <ServiceDetailsCard service={service} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <InspectionFormSections form={form} />

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
