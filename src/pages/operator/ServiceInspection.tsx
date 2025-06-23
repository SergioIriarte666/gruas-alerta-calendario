
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useServiceInspection } from '@/hooks/useServiceInspection';
import { inspectionFormSchema, InspectionFormValues } from '@/schemas/inspectionSchema';
import { validateFormBeforeSubmit } from '@/utils/inspectionValidation';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { ServiceDetailsCard } from '@/components/operator/ServiceDetailsCard';
import { InspectionFormSections } from '@/components/operator/InspectionFormSections';
import { PDFProgress } from '@/components/operator/PDFProgress';
import { ArrowLeft, Download, AlertTriangle, RefreshCW } from 'lucide-react';
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

  const { loadFormData } = useFormPersistence(form, id || '');

  useEffect(() => {
    if (id) {
      const savedData = loadFormData();
      if (savedData) {
        toast({ type: 'info', title: 'Datos del formulario restaurados' });
      }
    }
  }, [id, loadFormData, toast]);

  const onSubmit = (values: InspectionFormValues) => {
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Inspección Pre-Servicio</h1>
        </div>
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tms-green mx-auto"></div>
          <p className="mt-4">Cargando servicio...</p>
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Inspección Pre-Servicio</h1>
        </div>
        
        <div className="text-center p-8">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Error al cargar el servicio</h2>
          <p className="text-gray-600 mb-6">
            {error?.message || 'No se pudo cargar la información del servicio.'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            ID del servicio: {id}
          </p>
          <div className="space-x-4">
            <Button onClick={handleRetry}>
              <RefreshCW className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
            <Button onClick={() => navigate('/operator')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PDFProgress 
        isGenerating={isGeneratingPDF}
        progress={pdfProgress}
        currentStep={pdfStep}
        onManualDownload={handleManualDownload}
        downloadUrl={pdfDownloadUrl}
      />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Inspección Pre-Servicio</h1>
      </div>

      <ServiceDetailsCard service={service} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <InspectionFormSections form={form} />

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={processInspectionMutation.isPending || updateServiceStatusMutation.isPending || isGeneratingPDF}
            >
              <Download className="w-4 h-4 mr-2" />
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
