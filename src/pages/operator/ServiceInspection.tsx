import React from 'react';
import { useServiceInspection } from '@/hooks/useServiceInspection';
import { ServiceDetailsCard } from '@/components/operator/ServiceDetailsCard';
import { PDFProgress } from '@/components/operator/PDFProgress';
import { InspectionHeader } from '@/components/operator/inspection/InspectionHeader';
import { InspectionErrorState } from '@/components/operator/inspection/InspectionErrorState';
import { InspectionLoadingState } from '@/components/operator/inspection/InspectionLoadingState';
import { InspectionForm } from '@/components/operator/inspection/InspectionForm';
import { InspectionSuccess } from '@/components/operator/inspection/InspectionSuccess';
import { AlertTriangle } from 'lucide-react';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceInspection');

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
    completedInspection,
    processInspectionMutation,
    updateServiceStatusMutation,
    sendInspectionEmailMutation,
    handleManualDownload,
    handleSendEmail,
    handleSendWhatsApp,
    handleRetry,
    navigate
  } = useServiceInspection();

  logger.debug('Component Render:', {
    id,
    hasService: !!service,
    serviceFolio: service?.folio,
    isLoading,
    errorMessage: error?.message,
  });

  const handleBack = () => navigate(-1);

  if (!id) {
    logger.error('No service ID found. URL params issue.', {
      pathname: window.location.pathname,
      expected: '/operator/service/:id/inspection',
    });

    return (
      <div className="space-y-6">
        <InspectionHeader onBack={() => navigate('/operator')} />

        <div className="text-center p-8 bg-destructive/10 rounded-lg border border-destructive/30">
          <AlertTriangle className="size-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2 text-destructive">URL inválida</h2>
          <p className="text-muted-foreground mb-4">
            No se pudo obtener el ID del servicio desde la URL.
          </p>
          <div className="bg-muted p-3 rounded mb-6">
            <p className="text-sm text-muted-foreground font-mono">
              URL actual: {window.location.pathname}
            </p>
            <p className="text-sm text-muted-foreground font-mono">
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

  if (completedInspection) {
    return (
      <InspectionSuccess
        folio={service.folio}
        emailAvailable={Boolean(service.client?.email?.includes('@'))}
        phoneAvailable={Boolean(service.client?.phone || (service as any).contactPhone)}
        emailSent={completedInspection.emailSent}
        whatsappSent={completedInspection.whatsappSent}
        isSendingEmail={sendInspectionEmailMutation.isPending}
        onDownload={handleManualDownload}
        onSendEmail={handleSendEmail}
        onSendWhatsApp={handleSendWhatsApp}
        onBackToList={() => navigate('/operator')}
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
        onSubmit={(values, phase) => processInspectionMutation.mutate({ values, phase })}
        isProcessing={processInspectionMutation.isPending}
        isGeneratingPDF={isGeneratingPDF}
        isUpdatingStatus={updateServiceStatusMutation.isPending}
      />
    </div>
  );
};

export default ServiceInspection;
