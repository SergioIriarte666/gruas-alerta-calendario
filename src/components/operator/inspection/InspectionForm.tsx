
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
import { Download, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/custom-toast';
import { Service } from '@/types';
import { useInitialInspectionPDF } from '@/hooks/inspection/useInitialInspectionPDF';

interface InspectionFormProps {
  service: Service;
  serviceId: string;
  onSubmit: (values: InspectionFormValues, phase: 'initial' | 'final') => void;
  onGeneratePartialPDF?: (values: InspectionFormValues) => void;
  isProcessing: boolean;
  isGeneratingPDF: boolean;
  isUpdatingStatus: boolean;
}

export const InspectionForm = ({ 
  service, 
  serviceId, 
  onSubmit, 
  onGeneratePartialPDF,
  isProcessing, 
  isGeneratingPDF, 
  isUpdatingStatus 
}: InspectionFormProps) => {
  const { toast } = useToast();
  const [currentPhase, setCurrentPhase] = useState<'initial' | 'final'>('initial');
  const [isInitialized, setIsInitialized] = useState(false);
  const toastShownRef = useRef(false);
  
  // Hook para generar PDF de inspección inicial
  const { generateInitialPDF, isGeneratingInitialPDF } = useInitialInspectionPDF();
  
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
    
    console.log('🔄 InspectionForm - Initializing...');
    console.log('📊 Service status:', service?.status);
    console.log('📋 Saved data exists:', !!savedData);
    console.log('📊 Metadata exists:', !!metadata);
    
    // Si el servicio está en estado "pending", comenzar limpio
    if (service?.status === 'pending') {
      console.log('🧹 Service is pending - starting fresh');
      clearPersistedData();
      setCurrentPhase('initial');
      setIsInitialized(true);
      return;
    }
    
    // Si hay datos guardados, cargarlos
    if (savedData && metadata) {
      console.log('✅ Loading saved inspection data');
      console.log('📷 Photos count:', savedData.photographicSet?.length || 0);
      console.log('🔄 Loading phase:', metadata.inspection_phase);
      
      // Verificar que las fotos existen en localStorage
      if (savedData.photographicSet && savedData.photographicSet.length > 0) {
        const validPhotos = savedData.photographicSet.filter(photo => {
          const photoExists = localStorage.getItem(`photo-${photo.fileName}`) !== null;
          if (!photoExists) {
            console.warn(`🗑️ Photo not found in storage: ${photo.fileName}`);
          }
          return photoExists;
        });
        
        if (validPhotos.length !== savedData.photographicSet.length) {
          console.log(`📷 Cleaned photos: ${validPhotos.length}/${savedData.photographicSet.length}`);
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
        console.log('🚚 Service completed initial inspection - transitioning to final phase');
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
    } else {
      // Caso crítico: servicio en inspection_completed pero sin datos en memoria
      if (service?.status === 'inspection_completed') {
        try {
          // Intentar recuperar datos de localStorage
          const persistedData = localStorage.getItem(`inspection_${serviceId}`);
          const persistedMetadata = localStorage.getItem(`inspection_metadata_${serviceId}`);
          
          if (persistedData && persistedMetadata) {
            const parsedData = JSON.parse(persistedData);
            const parsedMetadata = JSON.parse(persistedMetadata);
            
            // Validar que las fotos existen en localStorage
            const validPhotos = parsedData.photographicSet?.filter((photo: any) => {
              return localStorage.getItem(`photo-${photo.fileName}`) !== null;
            }) || [];
            
            if (validPhotos.length > 0) {
              // Cargar datos en el formulario
              const dataToLoad = { ...parsedData, photographicSet: validPhotos };
              form.reset(dataToLoad);
              
              // Si la fase inicial está completa, ir a fase final
              if (parsedMetadata.signatures_status?.operator && parsedMetadata.signatures_status?.client) {
                setCurrentPhase('final');
                saveFormData(dataToLoad, 'final');
                if (!toastShownRef.current) {
                  toast({ type: 'success', title: 'Datos de inspección inicial recuperados correctamente' });
                  toastShownRef.current = true;
                }
              } else {
                setCurrentPhase('initial');
              }
            } else {
              console.log('🚚 Service inspection completed - ready for final phase but no photos found');
              setCurrentPhase('final');
              if (!toastShownRef.current) {
                toast({ 
                  type: 'warning', 
                  title: 'Datos de inspección encontrados pero las fotos no están disponibles'
                });
                toastShownRef.current = true;
              }
            }
          } else {
            console.log('🚚 Service inspection completed - ready for final phase but no data found');
            console.warn('⚠️ No hay datos de fase inicial guardados, pero el servicio está listo para entrega');
            setCurrentPhase('final');
            if (!toastShownRef.current) {
              toast({ 
                type: 'warning', 
                title: 'Sin datos de inspección inicial',
                description: 'El servicio está listo para entrega pero no se encontraron datos de la fase inicial'
              });
              toastShownRef.current = true;
            }
          }
        } catch (error) {
          console.error('Error al recuperar datos persistidos:', error);
          // Limpiar datos corruptos
          localStorage.removeItem(`inspection_${serviceId}`);
          localStorage.removeItem(`inspection_metadata_${serviceId}`);
          setCurrentPhase('final');
          if (!toastShownRef.current) {
            toast({ type: 'error', title: 'Error al cargar datos guardados. Datos limpiados.' });
            toastShownRef.current = true;
          }
        }
      } else {
        console.log('🔄 Starting initial phase');
        setCurrentPhase('initial');
      }
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

  const handleSubmit = (values: InspectionFormValues) => {
    console.log('📤 Submitting inspection form:', {
      phase: currentPhase,
      photosCount: values.photographicSet?.length || 0,
      hasOperatorSignature: !!values.operatorSignature,
      hasClientSignature: !!values.clientSignature,
      hasReceptionSignature: !!values.vehicleReceptionSignature
    });
    
    const validationErrors = validateFormBeforeSubmit(values, currentPhase);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast({ type: 'error', title: error }));
      return;
    }
    
    // Save form data before submitting
    saveFormData(values, currentPhase);
    onSubmit(values, currentPhase);
  };

  const handleGeneratePartialPDF = () => {
    const values = form.getValues();
    console.log('📄 Generating partial PDF with photos:', values.photographicSet?.length || 0);
    
    if (onGeneratePartialPDF) {
      onGeneratePartialPDF(values);
    }
  };

  const handleContinueToDelivery = () => {
    console.log('🚚 Continuing to delivery phase...');
    
    // Obtener valores actuales y asegurar que se guarden
    const currentValues = form.getValues();
    console.log('📷 Photos before phase change:', currentValues.photographicSet?.length || 0);
    
    // Guardar estado actual antes del cambio de fase
    saveFormData(currentValues, 'final');
    setCurrentPhase('final');
    
    toast({ 
      type: 'info', 
      title: 'Fase de entrega iniciada',
      description: 'Ahora puedes agregar la firma de recepción para completar la entrega'
    });
  };

  const handleGenerateInitialPDF = () => {
    const values = form.getValues();
    console.log('📄 [INITIAL] Generating initial inspection PDF with photos:', values.photographicSet?.length || 0);
    generateInitialPDF({ service, values });
  };

  return (
    <Form {...form}>
      {metadata && isInitialPhaseCompleted() && currentPhase === 'initial' && (
        <InspectionStatusCard
          metadata={metadata}
          onContinueToDelivery={handleContinueToDelivery}
          onGeneratePartialPDF={handleGeneratePartialPDF}
          onGenerateInitialPDF={handleGenerateInitialPDF}
          isGeneratingInitialPDF={isGeneratingInitialPDF}
        />
      )}
      
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <InspectionFormSections 
          form={form} 
          phase={currentPhase}
          isInitialCompleted={isInitialPhaseCompleted()}
        />

        <div className="flex justify-end gap-2">
          {currentPhase === 'initial' && (
            <Button 
              type="submit" 
              disabled={isProcessing || isUpdatingStatus || isGeneratingPDF}
            >
              <Download className="w-4 h-4 mr-2" />
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
              <CheckCircle className="w-4 h-4 mr-2" />
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
