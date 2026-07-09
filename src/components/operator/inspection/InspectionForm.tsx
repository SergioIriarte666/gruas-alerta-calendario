
import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInspectionPersistence } from '@/hooks/useInspectionPersistence';
import { inspectionFormSchema, InspectionFormValues } from '@/schemas/inspectionSchema';
import { validateFormBeforeSubmit } from '@/utils/inspectionValidation';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InspectionFormSections } from '@/components/operator/InspectionFormSections';
import { InspectionStatusCard } from './InspectionStatusCard';
import { InspectionProgressBar } from './InspectionProgressBar';
import { InitialInspectionEvidenceCard } from './InitialInspectionEvidence';
import { Download, CheckCircle, Eye, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/custom-toast';
import { toast as sonnerToast } from 'sonner';
import { Service } from '@/types';
import {
  ExistingInspectionConflict,
  fetchExistingInspectionConflict,
  fetchInitialInspectionEvidence,
  InitialInspectionEvidence,
  overwriteExistingInspectionPhase,
} from '@/utils/inspectionRecord';
import { getInspectionPdfSignedUrl } from '@/utils/inspectionPdfUpload';
import { extractStoragePath } from '@/utils/storagePath';
import { formatDateForDisplay } from '@/utils/timezoneUtils';
import { createLogger } from '@/lib/logger';
import { reportFrontendError } from '@/utils/reportFrontendError';
import { useUser } from '@/contexts/UserContext';
import { getPendingInspectionByServicePhase } from '@/utils/operatorOffline';
import { PhotoStorage } from '@/utils/photoStorage';
import { isInSituService } from '@/utils/inspectionPhase';

const logger = createLogger('InspectionForm');

interface InspectionFormProps {
  service: Service;
  serviceId: string;
  onSubmit: (values: InspectionFormValues, phase: 'initial' | 'final') => void;
  isProcessing: boolean;
  isGeneratingPDF: boolean;
  isUpdatingStatus: boolean;
  onCancelExisting?: () => void;
}

export const InspectionForm = ({
  service,
  serviceId,
  onSubmit,
  isProcessing,
  isGeneratingPDF,
  isUpdatingStatus,
  onCancelExisting,
}: InspectionFormProps) => {
  const { toast } = useToast();
  const { user } = useUser();
  const [currentPhase, setCurrentPhase] = useState<'initial' | 'final'>('initial');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);
  const [existingConflict, setExistingConflict] = useState<ExistingInspectionConflict | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [isOverwriting, setIsOverwriting] = useState(false);
  const [initialEvidence, setInitialEvidence] = useState<InitialInspectionEvidence | null>(null);
  const toastShownRef = useRef(false);
  const isAdmin = user?.role === 'admin';

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
    
    const expectedPhase: 'initial' | 'final' = service?.status === 'inspection_completed' ? 'final' : 'initial';

    fetchExistingInspectionConflict(serviceId, expectedPhase)
      .then((conflict) => {
        if (conflict) {
          setCurrentPhase(expectedPhase);
          setExistingConflict(conflict);
          setIsInitialized(true);
          return true;
        }
        return false;
      })
      .then(async (blockedByExisting) => {
        if (blockedByExisting) return;

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
      
      // Verificar que las fotos existen en almacenamiento local durable (IndexedDB)
      if (savedData.photographicSet && savedData.photographicSet.length > 0) {
        const validPhotos = [];
        for (const photo of savedData.photographicSet) {
          const photoExists = await PhotoStorage.exists(photo.fileName);
          if (!photoExists) {
            logger.warn(`🗑️ Photo not found in storage: ${photo.fileName}`);
            continue;
          }
          validPhotos.push(photo);
        }

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
      })
      .catch(async (error) => {
        logger.error('Error verificando inspección existente:', error);

        if (!navigator.onLine) {
          const pendingInitialInspection = await getPendingInspectionByServicePhase(serviceId, 'initial');

          if (expectedPhase === 'final' && pendingInitialInspection) {
            toast({
              type: 'warning',
              title: 'Entrega en espera de sincronización',
              description: 'La inspección inicial quedó guardada en este dispositivo y aún no llega a la base de datos. La entrega se habilitará cuando vuelva la conexión.',
            });
          } else {
            toast({
              type: 'info',
              title: 'Modo sin conexión',
              description: 'No fue posible validar inspecciones existentes en la base de datos. Puede continuar con la información local disponible.',
            });
          }

          setIsInitialized(true);
          return;
        }

        toast({ type: 'error', title: 'No se pudo verificar si ya existe una inspección' });
        reportFrontendError({
          componentName: 'InspectionForm.fetchExistingInspectionConflict',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          url: window.location.href,
        }).catch(() => {});
        setIsInitialized(true);
      })
      .finally(() => setIsCheckingExisting(false));
  }, [serviceId, service?.status]); // Dependencias optimizadas

  // Auto-save form data - solo después de inicialización
  useEffect(() => {
    if (!isInitialized) return;
    
    const subscription = form.watch((data) => {
      if (data && Object.keys(data).length > 0) {
        const formData = data as InspectionFormValues;
        const hasMeaningfulContent = Boolean(
          formData.photographicSet?.length ||
          formData.operatorSignature ||
          formData.clientSignature ||
          formData.vehicleReceptionSignature ||
          formData.vehicleObservations ||
          formData.kilometraje ||
          formData.equipment?.length ||
          formData.combustible ||
          formData.llaves ||
          formData.documentacion ||
          formData.clientName ||
          formData.clientRut ||
          formData.receptionPersonName
        );

        if (hasMeaningfulContent) {
          saveFormData(formData, currentPhase);
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [currentPhase, form, saveFormData, isInitialized]);

  const requiresDetail  = service.serviceType?.requiresDetail  ?? true;
  const requiresPhotoSet = service.serviceType?.requiresPhotoSet ?? true;
  const isInSitu = isInSituService(service);

  const handleViewExisting = async () => {
    if (!existingConflict) return;
    try {
      const pdfPath = extractStoragePath(existingConflict.pdfPath, 'inspection-pdfs') || existingConflict.pdfPath;
      const signedUrl = await getInspectionPdfSignedUrl(pdfPath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      logger.error('Error abriendo inspección existente:', error);
      sonnerToast.error('No se pudo abrir la inspección existente');
      reportFrontendError({
        componentName: 'InspectionForm.handleViewExisting',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
      }).catch(() => {});
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!existingConflict || !isAdmin) return;
    setIsOverwriting(true);
    try {
      await overwriteExistingInspectionPhase(existingConflict, currentPhase);
      clearPersistedData();
      setExistingConflict(null);
      setShowOverwriteConfirm(false);
      setIsInitialized(true);
      setIsCheckingExisting(false);
      sonnerToast.success('Inspección existente eliminada. Puede capturar nuevamente.');
    } catch (error) {
      logger.error('Error sobrescribiendo inspección existente:', error);
      sonnerToast.error(error instanceof Error ? error.message : 'No se pudo sobrescribir la inspección existente');
      reportFrontendError({
        componentName: 'InspectionForm.handleConfirmOverwrite',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
      }).catch(() => {});
    } finally {
      setIsOverwriting(false);
    }
  };

  const handleSubmit = (values: InspectionFormValues) => {
    logger.debug('📤 Submitting inspection form:', {
      phase: currentPhase,
      photosCount: values.photographicSet?.length || 0,
      hasOperatorSignature: !!values.operatorSignature,
      hasClientSignature: !!values.clientSignature,
      hasReceptionSignature: !!values.vehicleReceptionSignature
    });

    const validationErrors = validateFormBeforeSubmit(values, currentPhase, { requiresDetail, requiresPhotoSet, isInSitu });
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast({ type: 'error', title: error }));
      return;
    }
    
    // Save form data before submitting
    saveFormData(values, currentPhase);
    onSubmit(values, currentPhase);
  };

  if (isCheckingExisting) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Verificando inspecciones existentes...
      </div>
    );
  }

  if (existingConflict) {
    const phaseLabel = currentPhase === 'initial' ? 'inspección inicial' : 'inspección de entrega';
    const operatorLabel = existingConflict.operatorName || 'operador no identificado';
    const createdAtLabel = formatDateForDisplay(existingConflict.createdAt);

    return (
      <>
        <Dialog open onOpenChange={(open) => { if (!open) onCancelExisting?.(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ya existe una inspección</DialogTitle>
              <DialogDescription>
                Ya existe una inspección para este servicio (fecha {createdAtLabel}, operador {operatorLabel}). ¿Qué desea hacer?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onCancelExisting}>
                Cancelar
              </Button>
              {isAdmin && (
                <Button type="button" variant="destructive" onClick={() => setShowOverwriteConfirm(true)}>
                  <RotateCcw className="size-4 mr-2" />
                  Sobrescribir
                </Button>
              )}
              <Button type="button" onClick={handleViewExisting}>
                <Eye className="size-4 mr-2" />
                Ver inspección existente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showOverwriteConfirm} onOpenChange={setShowOverwriteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar sobrescritura</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará la {phaseLabel} existente y su PDF asociado. Solo continúe si un administrador confirmó que debe recapturarse.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isOverwriting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={isOverwriting} onClick={handleConfirmOverwrite}>
                {isOverwriting ? 'Limpiando...' : 'Confirmar sobrescritura'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

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
          isInSitu={isInSitu}
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
               isInSitu ? 'Completar Servicio' : 'Completar Inspección Inicial'}
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
