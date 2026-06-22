
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
      clientName: '',
      clientRut: '',
      clientSignature: '',
      vehicleReceptionSignature: '',
      receptionPersonName: '',
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
      
      // Determinar fase correcta basada en el estado del servicio Y los metadatos
      if (service?.status === 'inspection_completed' && metadata.inspection_phase === 'initial') {
        logger.debug('🚚 Service completed initial inspection - transitioning to final phase');
        setCurrentPhase('final');
        // Guardar los datos como fase final para continuar con la entrega
        saveFormData(savedData, 'final');
      } else {
        setCurrentPhase(metadata.inspection_phase);
      }
      
      if (!toastShownRef.current) {
        toast({ 
          type: 'info', 
          title: `Datos cargados - Fase ${currentPhase === 'initial' ? 'Inicial' : 'Final'}`,
          description: `${savedData.photographicSet?.length || 0} fotografías de la fase inicial disponibles`
        });
        toastShownRef.current = true;
      }
    } else if (service?.status === 'inspection_completed') {
      // Sin cache de sesión (pestaña/dispositivo distinto, o sessionStorage vencido): la base
      // de datos es la única fuente confiable de la evidencia de la fase inicial.
      setCurrentPhase('final');
      fetchInitialInspectionEvidence(serviceId)
        .then((evidence) => {
          if (evidence) {
            logger.debug('🚚 Evidencia de fase inicial recuperada desde la base de datos');
            setInitialEvidence(evidence);
            if (!toastShownRef.current) {
              toast({
                type: 'success',
                title: 'Datos de inspección inicial recuperados',
                description: `${evidence.photos.length} fotografía(s) de la fase inicial disponibles`
              });
              toastShownRef.current = true;
            }
          } else {
            logger.warn('⚠️ La base de datos no tiene inspección inicial para este servicio');
            if (!toastShownRef.current) {
              toast({
                type: 'warning',
                title: 'Sin datos de inspección inicial',
                description: 'El servicio está listo para entrega pero no se encontraron datos de la fase inicial'
              });
              toastShownRef.current = true;
            }
          }
        })
        .catch((error) => {
          logger.error('Error al recuperar evidencia de inspección inicial desde la base de datos:', error);
          if (!toastShownRef.current) {
            toast({ type: 'error', title: 'Error al cargar la inspección inicial desde la base de datos' });
            toastShownRef.current = true;
          }
        })
        .finally(() => setIsInitialized(true));
      return;
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
        // Solo guardar si hay cambios significativos
        if (formData.photographicSet?.length || formData.operatorSignature || formData.clientSignature) {
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
