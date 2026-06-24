
import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInspectionPersistence } from '@/hooks/useInspectionPersistence';
import { inspectionFormSchema, InspectionFormValues } from '@/schemas/inspectionSchema';
import { validateFormBeforeSubmit } from '@/utils/inspectionValidation';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { InspectionFormSections } from '@/components/operator/InspectionFormSections';
import { InspectionStatusCard } from './InspectionStatusCard';
import { InspectionProgressBar } from './InspectionProgressBar';
import { InitialInspectionEvidenceCard } from './InitialInspectionEvidence';
import { Download, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/custom-toast';
import { Service } from '@/types';
import { fetchInitialInspectionEvidence, InitialInspectionEvidence } from '@/utils/inspectionRecord';
import { createLogger } from '@/lib/logger';
import { reportFrontendError } from '@/utils/reportFrontendError';

const logger = createLogger('InspectionForm');

interface InspectionFormProps {
  service: Service;
  serviceId: string;
  onSubmit: (values: InspectionFormValues, phase: 'initial' | 'final') => void;
  isProcessing: boolean;
  isGeneratingPDF: boolean;
  isUpdatingStatus: boolean;
}

export const InspectionForm = ({
  service,
  serviceId,
  onSubmit,
  isProcessing,
  isGeneratingPDF,
  isUpdatingStatus
}: InspectionFormProps) => {
  const { toast } = useToast();
  const [currentPhase, setCurrentPhase] = useState<'initial' | 'final'>('initial');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialEvidence, setInitialEvidence] = useState<InitialInspectionEvidence | null>(null);
  const toastShownRef = useRef(false);

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      equipment: [],
      vehicleObservations: '',
      kilometraje: '',
      combustible: undefined,
      llaves: undefined,
      documentacion: undefined,
      operatorSignature: '',
      operatorName: service.operator?.name || '',
      clientName: service.client?.name || '',
      clientRut: '',
      clientSignature: '',
      vehicleReceptionSignature: '',
      receptionPersonName: service.client?.name || '',
      photographicSet: [],
    },
  });

  const { 
    savedData, 
    metadata, 
    saveFormData, 
    clearPersistedData, 
    isInitialPhaseCompleted, 
    canProceedToFinal 
  } = useInspectionPersistence(serviceId);

  useEffect(() => {
    if (isInitialized) return; // Evitar re-ejecuciones
    
    logger.debug('🔄 InspectionForm - Initializing...');
    logger.debug('📊 Service status:', service?.status);
    logger.debug('📋 Saved data exists:', !!savedData);
    logger.debug('📊 Metadata exists:', !!metadata);
    
    // Si el servicio está en estado "pending", comenzar limpio
    if (service?.status === 'pending') {
      logger.debug('🧹 Service is pending - starting fresh');
      clearPersistedData();
      setCurrentPhase('initial');
      setIsInitialized(true);
      return;
    }
    
    // En entrega, la DB siempre es la fuente de verdad. La caché puede ayudar a
    // recuperar campos locales, pero nunca decide si existe evidencia inicial.
    if (service?.status === 'inspection_completed') {
      setCurrentPhase('final');
      fetchInitialInspectionEvidence(serviceId)
        .then((evidence) => {
          if (!evidence) {
            logger.warn('⚠️ La base de datos no tiene inspección inicial para este servicio');
            toast({
              type: 'warning',
              title: 'Sin datos de inspección inicial',
              description: 'La base de datos no contiene una inspección inicial para este servicio'
            });
            return;
          }

          setInitialEvidence(evidence);
          const initialState = evidence.initialState;
          form.reset({
            ...form.getValues(),
            equipment: initialState.equipment.length > 0 ? initialState.equipment : savedData?.equipment || [],
            kilometraje: initialState.kilometraje || savedData?.kilometraje || '',
            combustible: initialState.combustible || savedData?.combustible,
            llaves: initialState.llaves || savedData?.llaves,
            documentacion: initialState.documentacion || savedData?.documentacion,
            vehicleObservations: savedData?.vehicleObservations || '',
            operatorName: service.operator?.name || '',
            clientName: service.client?.name || savedData?.clientName || '',
            receptionPersonName: service.client?.name || '',
            operatorSignature: '',
            clientSignature: '',
            vehicleReceptionSignature: '',
            photographicSet: [],
          });
          saveFormData(form.getValues(), 'final');
          if (evidence.storageTier === 'deleted') {
            toast({
              type: 'warning',
              title: 'Respaldo histórico eliminado',
              description: 'Los archivos cumplieron el plazo de retención de 2 años; el registro de la inspección se conserva.'
            });
          } else {
            toast({
              type: 'success',
              title: evidence.storageTier === 'cold' ? 'Respaldo histórico recuperado' : 'Inspección inicial recuperada',
              description: `${evidence.photos.length} fotografía(s) disponibles; estado inicial precargado para comparar`
            });
          }
        })
        .catch((error) => {
          logger.error('Error al recuperar evidencia de inspección inicial desde la base de datos:', error);
          toast({ type: 'error', title: 'No se pudo cargar la inspección inicial' });
          reportFrontendError({
            componentName: 'InspectionForm.fetchInitialInspectionEvidence',
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            url: window.location.href,
          }).catch(() => {});
        })
        .finally(() => setIsInitialized(true));
      return;
    }

    // Si hay datos guardados, cargarlos
    if (savedData && metadata) {
      logger.debug('✅ Loading saved inspection data');
      logger.debug('📷 Photos count:', savedData.photographicSet?.length || 0);
      logger.debug('🔄 Loading phase:', metadata.inspection_phase);
      
      // Verificar que las fotos existen en sessionStorage
      if (savedData.photographicSet && savedData.photographicSet.length > 0) {
        const validPhotos = savedData.photographicSet.filter(photo => {
          const photoExists = sessionStorage.getItem(`photo-${photo.fileName}`) !== null;
          if (!photoExists) {
            logger.warn(`🗑️ Photo not found in storage: ${photo.fileName}`);
          }
          return photoExists;
        });
        
        if (validPhotos.length !== savedData.photographicSet.length) {
          logger.debug(`📷 Cleaned photos: ${validPhotos.length}/${savedData.photographicSet.length}`);
          const cleanedData = { ...savedData, photographicSet: validPhotos };
          saveFormData(cleanedData, metadata.inspection_phase);
          form.reset(cleanedData);
        } else {
          form.reset(savedData);
        }
      } else {
        form.reset(savedData);
      }
      
      setCurrentPhase(metadata.inspection_phase);
      
      if (!toastShownRef.current) {
        toast({ 
          type: 'info', 
          title: `Datos cargados - Fase ${currentPhase === 'initial' ? 'Inicial' : 'Final'}`,
          description: `${savedData.photographicSet?.length || 0} fotografías de la fase inicial disponibles`
        });
        toastShownRef.current = true;
      }
    } else {
      logger.debug('🔄 Starting initial phase');
      setCurrentPhase('initial');
    }

    setIsInitialized(true);
  }, [serviceId, service?.status]); // Dependencias optimizadas

  // Auto-save form data - solo después de inicialización
  useEffect(() => {
    if (!isInitialized) return;
    
    const subscription = form.watch((data) => {
      if (data && Object.keys(data).length > 0) {
        const formData = data as InspectionFormValues;
        // Fotos y firmas son evidencia crítica en ambas fases.
        if (formData.photographicSet?.length || formData.operatorSignature || formData.clientSignature || formData.vehicleReceptionSignature) {
          saveFormData(formData, currentPhase);
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [currentPhase, form, saveFormData, isInitialized]);

  const requiresDetail  = service.serviceType?.requiresDetail  ?? true;
  const requiresPhotoSet = service.serviceType?.requiresPhotoSet ?? true;

  const handleSubmit = (values: InspectionFormValues) => {
    logger.debug('📤 Submitting inspection form:', {
      phase: currentPhase,
      photosCount: values.photographicSet?.length || 0,
      hasOperatorSignature: !!values.operatorSignature,
      hasClientSignature: !!values.clientSignature,
      hasReceptionSignature: !!values.vehicleReceptionSignature
    });

    const validationErrors = validateFormBeforeSubmit(values, currentPhase, { requiresDetail, requiresPhotoSet });
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast({ type: 'error', title: error }));
      return;
    }
    
    // Save form data before submitting
    saveFormData(values, currentPhase);
    onSubmit(values, currentPhase);
  };

  return (
    <Form {...form}>
      {metadata && isInitialPhaseCompleted() && currentPhase === 'initial' && (
        <InspectionStatusCard metadata={metadata} />
      )}

      {currentPhase === 'final' && initialEvidence && (
        <InitialInspectionEvidenceCard evidence={initialEvidence} />
      )}

      <InspectionProgressBar form={form} phase={currentPhase} />

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <InspectionFormSections
          form={form}
          phase={currentPhase}
          isInitialCompleted={isInitialPhaseCompleted()}
          serviceId={serviceId}
          requiresDetail={requiresDetail}
          requiresPhotoSet={requiresPhotoSet}
          clientName={service.client?.name || ''}
          operatorName={service.operator?.name || ''}
        />

        <div className="flex justify-end gap-2">
          {currentPhase === 'initial' && (
            <Button 
              type="submit" 
              disabled={isProcessing || isUpdatingStatus || isGeneratingPDF}
            >
              <Download className="size-4 mr-2" />
              {isGeneratingPDF ? 'Generando PDF...' : 
               isProcessing ? 'Procesando...' : 
               isUpdatingStatus ? 'Iniciando Servicio...' : 
               'Completar Inspección Inicial'}
            </Button>
          )}
          
          {currentPhase === 'final' && (
            <Button 
              type="submit" 
              disabled={isProcessing || isUpdatingStatus || isGeneratingPDF}
            >
              <CheckCircle className="size-4 mr-2" />
              {isGeneratingPDF ? 'Generando PDF Final...' : 
               isProcessing ? 'Finalizando...' : 
               isUpdatingStatus ? 'Completando Servicio...' : 
               'Finalizar Servicio y Generar PDF'}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};
