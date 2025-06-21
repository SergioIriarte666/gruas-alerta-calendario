
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
}

export const ServiceFormPersistence = ({
  service,
  folio,
  isManualFolio,
  formData,
  requestDate,
  serviceDate,
  onDataRestore
}: ServiceFormPersistenceProps) => {
  const { toast } = useToast();
  const [showPersistedDataAlert, setShowPersistedDataAlert] = useState(false);

  const persistenceKey = service ? `edit-service-${service.id}` : 'new-service';
  const persistenceData = {
    folio,
    isManualFolio,
    formData,
    requestDate: requestDate.toISOString(),
    serviceDate: serviceDate.toISOString()
  };

  const { clearFormData, hasPersistedData } = useGenericFormPersistence(
    persistenceData,
    (data) => {
      if (typeof data === 'function') return;
      onDataRestore(data);
    },
    { 
      key: persistenceKey,
      debounceMs: 2000
    }
  );

  useEffect(() => {
    if (!service && hasPersistedData()) {
      setShowPersistedDataAlert(true);
    }
  }, [service, hasPersistedData]);

  const handleDiscardPersistedData = () => {
    clearFormData();
    setShowPersistedDataAlert(false);
    toast({
      type: 'info',
      title: 'Datos descartados',
      description: 'Se han eliminado los datos guardados anteriormente'
    });
  };

  return (
    <>
      {showPersistedDataAlert && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Save className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200 flex items-center justify-between">
            <span>Se encontraron datos guardados anteriormente. ¿Deseas continuar desde donde lo dejaste?</span>
            <div className="ml-4 space-x-2">
              <button 
                onClick={() => setShowPersistedDataAlert(false)}
                className="text-blue-300 hover:text-blue-100 underline text-sm"
              >
                Continuar
              </button>
              <button 
                onClick={handleDiscardPersistedData}
                className="text-blue-300 hover:text-blue-100 underline text-sm"
              >
                Descartar
              </button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-gray-800/90 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-2">
          <Save className="w-3 h-3" />
          <span>Guardado automático activo</span>
        </div>
      </div>
    </>
  );
};
