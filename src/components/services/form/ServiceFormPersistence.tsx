
import { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useGenericFormPersistence } from '@/hooks/useGenericFormPersistence';
import { useToast } from '@/components/ui/custom-toast';
import { Service } from '@/types';

interface ServiceFormPersistenceProps {
  service?: Service | null;
  folio: string;
  isManualFolio: boolean;
  formData: any;
  requestDate: Date;
  serviceDate: Date;
  onDataRestore: (data: any) => void;
  onDataClear?: () => void;
  onMarkAsSubmitted?: (fn: () => void) => void;
}

export const ServiceFormPersistence = ({
  service,
  folio,
  isManualFolio,
  formData,
  requestDate,
  serviceDate,
  onDataRestore,
  onDataClear,
  onMarkAsSubmitted
}: ServiceFormPersistenceProps) => {
  const { toast } = useToast();
  const [showPersistedDataAlert, setShowPersistedDataAlert] = useState(false);
  const [hasShownAlert, setHasShownAlert] = useState(false);
  
  const persistenceKey = service ? `edit-service-${service.id}` : 'new-service';
  const persistenceData = {
    folio,
    isManualFolio,
    formData,
    requestDate: requestDate.toISOString(),
    serviceDate: serviceDate.toISOString()
  };

  const {
    clearFormData,
    hasPersistedData,
    markAsSubmitted
  } = useGenericFormPersistence(persistenceData, (data) => {
    if (typeof data === 'function') return;
    onDataRestore(data);
  }, {
    key: persistenceKey,
    debounceMs: 2000,
    clearOnSuccess: true
  });

  // Exponer la función markAsSubmitted al componente padre
  useEffect(() => {
    if (onMarkAsSubmitted) {
      onMarkAsSubmitted(markAsSubmitted);
    }
  }, [markAsSubmitted, onMarkAsSubmitted]);

  useEffect(() => {
    // Solo mostrar alerta para nuevos servicios y solo una vez
    if (!service && hasPersistedData() && !hasShownAlert) {
      setShowPersistedDataAlert(true);
      setHasShownAlert(true);
    }
  }, [service, hasPersistedData, hasShownAlert]);

  const handleRestoreData = () => {
    const savedData = localStorage.getItem(`form-persistence-${persistenceKey}`);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        onDataRestore(parsedData);
        setShowPersistedDataAlert(false);
        toast({
          type: 'success',
          title: 'Datos restaurados',
          description: 'Se han cargado los datos guardados anteriormente'
        });
      } catch (error) {
        console.error('Error restoring data:', error);
        toast({
          type: 'error',
          title: 'Error',
          description: 'No se pudieron restaurar los datos guardados'
        });
      }
    }
  };

  const handleDiscardPersistedData = () => {
    console.log('🗑️ Discarding persisted data and clearing form');
    
    // Primero limpiar los datos persistidos
    clearFormData();
    setShowPersistedDataAlert(false);
    
    // Luego limpiar el formulario actual
    if (onDataClear) {
      console.log('🧹 Calling onDataClear to reset form');
      onDataClear();
    }
    
    toast({
      type: 'info',
      title: 'Datos descartados',
      description: 'Se han eliminado los datos guardados y limpiado el formulario'
    });
  };

  return (
    <>
      {showPersistedDataAlert && (
        <Alert className="mb-4 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex-1">
              <strong className="text-blue-800">Datos guardados detectados</strong>
              <p className="text-blue-700 text-sm mt-1">
                Se encontraron datos de un servicio anterior. ¿Deseas restaurarlos o empezar con un formulario limpio?
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRestoreData}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                Restaurar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscardPersistedData}
                className="text-gray-600 border-gray-300 hover:bg-gray-100"
              >
                <X className="w-3 h-3 mr-1" />
                Descartar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
