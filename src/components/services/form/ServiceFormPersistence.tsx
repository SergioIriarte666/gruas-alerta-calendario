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
  const {
    toast
  } = useToast();
  const [showPersistedDataAlert, setShowPersistedDataAlert] = useState(false);
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
    hasPersistedData
  } = useGenericFormPersistence(persistenceData, data => {
    if (typeof data === 'function') return;
    onDataRestore(data);
  }, {
    key: persistenceKey,
    debounceMs: 2000
  });
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
  return <>
      {showPersistedDataAlert}

      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-gray-800/90 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-2">
          <Save className="w-3 h-3" />
          <span>Guardado automático activo</span>
        </div>
      </div>
    </>;
};