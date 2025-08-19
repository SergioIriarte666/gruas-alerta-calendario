
import { useState, useEffect } from 'react';
import { InspectionFormValues } from '@/schemas/inspectionSchema';

export interface InspectionPhaseMetadata {
  inspection_phase: 'initial' | 'final';
  initial_completion_date?: string;
  signatures_status: {
    operator: boolean;
    client: boolean;
    reception: boolean;
  };
  service_id: string;
}

export const useInspectionPersistence = (serviceId: string) => {
  const [savedData, setSavedData] = useState<InspectionFormValues | null>(null);
  const [metadata, setMetadata] = useState<InspectionPhaseMetadata | null>(null);

  const storageKey = `inspection_${serviceId}`;
  const metadataKey = `inspection_metadata_${serviceId}`;

  useEffect(() => {
    // Load saved data on mount
    const saved = localStorage.getItem(storageKey);
    const savedMetadata = localStorage.getItem(metadataKey);

    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        console.log('📋 Loaded inspection data:', {
          photos: parsedData.photographicSet?.length || 0,
          phase: savedMetadata ? JSON.parse(savedMetadata).inspection_phase : 'unknown'
        });
        setSavedData(parsedData);
      } catch (error) {
        console.error('Error parsing saved inspection data:', error);
        localStorage.removeItem(storageKey);
      }
    }

    if (savedMetadata) {
      try {
        const parsedMetadata = JSON.parse(savedMetadata);
        setMetadata(parsedMetadata);
      } catch (error) {
        console.error('Error parsing metadata:', error);
        localStorage.removeItem(metadataKey);
      }
    }
  }, [storageKey, metadataKey]);

  const saveFormData = (data: InspectionFormValues, phase: 'initial' | 'final') => {
    console.log('💾 Saving inspection data:', {
      phase,
      photos: data.photographicSet?.length || 0,
      hasOperatorSignature: !!data.operatorSignature,
      hasClientSignature: !!data.clientSignature,
      hasReceptionSignature: !!data.vehicleReceptionSignature
    });

    // Para la fase final, preservar datos de la fase inicial y agregar nuevos
    let finalData = data;
    if (phase === 'final' && savedData) {
      finalData = {
        ...savedData, // Datos de fase inicial
        ...data, // Nuevos datos de fase final
        // Preservar fotos de fase inicial
        photographicSet: [
          ...(savedData.photographicSet || []),
          ...(data.photographicSet || []).filter(photo => 
            !savedData.photographicSet?.some(existing => existing.fileName === photo.fileName)
          )
        ]
      };
    }

    const newMetadata: InspectionPhaseMetadata = {
      inspection_phase: phase,
      initial_completion_date: phase === 'initial' ? new Date().toISOString() : metadata?.initial_completion_date,
      signatures_status: {
        operator: !!finalData.operatorSignature,
        client: !!finalData.clientSignature,
        reception: !!finalData.vehicleReceptionSignature,
      },
      service_id: serviceId,
    };

    localStorage.setItem(storageKey, JSON.stringify(finalData));
    localStorage.setItem(metadataKey, JSON.stringify(newMetadata));
    
    setSavedData(finalData);
    setMetadata(newMetadata);
  };

  const clearPersistedData = () => {
    console.log('🧹 Clearing all inspection persistence data');
    localStorage.removeItem(storageKey);
    localStorage.removeItem(metadataKey);
    setSavedData(null);
    setMetadata(null);
  };

  const isInitialPhaseCompleted = () => {
    return metadata?.inspection_phase === 'initial' && 
           metadata?.signatures_status.operator && 
           metadata?.signatures_status.client;
  };

  const canProceedToFinal = () => {
    return isInitialPhaseCompleted();
  };

  return {
    savedData,
    metadata,
    saveFormData,
    clearPersistedData,
    isInitialPhaseCompleted,
    canProceedToFinal,
    currentPhase: metadata?.inspection_phase || 'initial',
  };
};
