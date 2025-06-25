
import React from 'react';
import { useServiceInspection } from '@/hooks/useServiceInspection';
import { ServiceDetailsCard } from '@/components/operator/ServiceDetailsCard';
import { PDFProgress } from '@/components/operator/PDFProgress';
import { InspectionHeader } from '@/components/operator/inspection/InspectionHeader';
import { InspectionErrorState } from '@/components/operator/inspection/InspectionErrorState';
import { InspectionLoadingState } from '@/components/operator/inspection/InspectionLoadingState';
import { InspectionForm } from '@/components/operator/inspection/InspectionForm';
import { AlertTriangle } from 'lucide-react';

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

  // Agregar logging detallado para debug
  console.log('🎬 ServiceInspection Component Render:', {
    id,
    hasService: !!service,
    serviceFolio: service?.folio,
    isLoading,
    errorMessage: error?.message,
    currentURL: window.location.href,
    pathname: window.location.pathname
  });

  const handleBack = () => navigate(-1);

  // Mostrar error si no hay ID del servicio
  if (!id) {
    console.error('❌ No service ID found. URL params issue.');
    console.error('❌ Current pathname:', window.location.pathname);
    console.error('❌ Expected pattern: /operator/service/:id/inspection');
    
    return (
      <div className="space-y-6">
        <InspectionHeader onBack={() => navigate('/operator')} />
        
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2 text-red-800">URL inválida</h2>
          <p className="text-red-600 mb-4">
            No se pudo obtener el ID del servicio desde la URL.
          </p>
          <div className="bg-red-100 p-3 rounded mb-6">
            <p className="text-sm text-red-700 font-mono">
              URL actual: {window.location.pathname}
            </p>
            <p className="text-sm text-red-700 font-mono">
              Formato esperado: /operator/service/[ID]/inspection
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return <InspectionLoadingState serviceId={id} onBack={handleBack} />;
  }

  if (error || !service) {
    return (
      <InspectionErrorState 
        error={error}
        serviceId={id}
        onRetry={handleRetry}
        onBack={handleBack}
      />
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

      <InspectionHeader onBack={handleBack} />

      <ServiceDetailsCard service={service} />

      <InspectionForm
        service={service}
        serviceId={id}
        onSubmit={(values) => processInspectionMutation.mutate(values)}
        isProcessing={processInspectionMutation.isPending}
        isGeneratingPDF={isGeneratingPDF}
        isUpdatingStatus={updateServiceStatusMutation.isPending}
      />
    </div>
  );
};

export default ServiceInspection;
