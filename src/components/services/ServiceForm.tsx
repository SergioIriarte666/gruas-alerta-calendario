
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { Service } from '@/types';
import { FolioSection } from './form/FolioSection';
import { DateSection } from './form/DateSection';
import { ClientServiceSection } from './form/ClientServiceSection';
import { VehicleSection } from './form/VehicleSection';
import { LocationSection } from './form/LocationSection';
import { ResourceSection } from './form/ResourceSection';
import { FinancialSection } from './form/FinancialSection';
import { ObservationsSection } from './form/ObservationsSection';
import { FormActions } from './form/FormActions';
import { useServiceFormData } from '@/hooks/services/useServiceFormData';
import { useServiceFormEffects } from '@/hooks/services/useServiceFormEffects';
import { useServiceFormSubmission } from '@/hooks/services/useServiceFormSubmission';
import { useGenericFormPersistence } from '@/hooks/useGenericFormPersistence';
import { useUser } from '@/contexts/UserContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Save } from 'lucide-react';
import { useToast } from '@/components/ui/custom-toast';
import { useEffect, useState } from 'react';

interface ServiceFormProps {
  service?: Service | null;
  onSubmit: (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'> & { folio: string }) => void;
  onCancel: () => void;
}

export const ServiceForm = ({ service, onSubmit, onCancel }: ServiceFormProps) => {
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { data: operators = [] } = useOperatorsData();
  const { serviceTypes, loading: serviceTypesLoading } = useServiceTypes();
  const { user } = useUser();
  const { toast } = useToast();
  const [showPersistedDataAlert, setShowPersistedDataAlert] = useState(false);

  const {
    isManualFolio,
    setIsManualFolio,
    folio,
    setFolio,
    formData,
    setFormData,
    requestDate,
    setRequestDate,
    serviceDate,
    setServiceDate
  } = useServiceFormData(service);

  const { handleGenerateNewFolio, folioLoading } = useServiceFormEffects(
    isManualFolio,
    service,
    setFolio
  );

  const { handleSubmit } = useServiceFormSubmission({
    service,
    onSubmit,
    clients,
    cranes,
    operators,
    serviceTypes
  });

  // Form persistence
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
      setFolio(data.folio || '');
      setIsManualFolio(data.isManualFolio || false);
      setFormData(data.formData || formData);
      if (data.requestDate) setRequestDate(new Date(data.requestDate));
      if (data.serviceDate) setServiceDate(new Date(data.serviceDate));
    },
    { 
      key: persistenceKey,
      debounceMs: 2000 // Save every 2 seconds
    }
  );

  // Check for persisted data on mount
  useEffect(() => {
    if (!service && hasPersistedData()) {
      setShowPersistedDataAlert(true);
    }
  }, [service, hasPersistedData]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    try {
      await handleSubmit(e, folio, formData, isManualFolio);
      // Clear persisted data on successful submission
      clearFormData();
      toast({
        type: 'success',
        title: 'Servicio guardado',
        description: 'El servicio se ha guardado correctamente'
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        type: 'error',
        title: 'Error al guardar',
        description: 'No se pudo guardar el servicio. Los datos se mantienen guardados localmente.'
      });
    }
  };

  const handleDiscardPersistedData = () => {
    clearFormData();
    setShowPersistedDataAlert(false);
    toast({
      type: 'info',
      title: 'Datos descartados',
      description: 'Se han eliminado los datos guardados anteriormente'
    });
  };

  const compatibleServiceTypes = serviceTypes.map(st => ({
    ...st,
    description: st.description || '',
  }));

  // Get the selected service type for the VehicleSection component
  const selectedServiceType = serviceTypes.find(st => st.id === formData.serviceTypeId);
  
  // Check if service is invoiced and user permissions
  const isInvoiced = service?.status === 'invoiced';
  const isAdmin = user?.role === 'admin';
  // Administrators CAN edit invoiced services
  const canEdit = !isInvoiced || isAdmin;

  return (
    <div className="space-y-6">
      {/* Persisted data alert */}
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

      {/* Warning alert for invoiced services */}
      {isInvoiced && (
        <Alert className="border-purple-500/50 bg-purple-500/10">
          <AlertTriangle className="h-4 w-4 text-purple-400" />
          <AlertDescription className="text-purple-200">
            {isAdmin 
              ? "⚠️ CUIDADO: Este servicio está facturado. Como administrador, puedes editarlo, pero ten precaución con los cambios."
              : "Este servicio está facturado y no puede ser editado. Solo los administradores pueden hacerlo."
            }
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-6">
        <FolioSection
          folio={folio}
          onFolioChange={setFolio}
          isManualFolio={isManualFolio}
          onManualFolioChange={setIsManualFolio}
          onGenerateNewFolio={handleGenerateNewFolio}
          isEditing={!!service}
          isLoading={folioLoading}
          disabled={!canEdit}
        />

        <DateSection
          requestDate={requestDate}
          serviceDate={serviceDate}
          onRequestDateChange={setRequestDate}
          onServiceDateChange={setServiceDate}
          disabled={!canEdit}
        />

        <ClientServiceSection
          clientId={formData.clientId}
          onClientChange={(value) => setFormData(prev => ({ ...prev, clientId: value }))}
          clients={clients}
          purchaseOrder={formData.purchaseOrder}
          onPurchaseOrderChange={(value) => setFormData(prev => ({ ...prev, purchaseOrder: value }))}
          serviceTypeId={formData.serviceTypeId}
          onServiceTypeChange={(value) => setFormData(prev => ({ ...prev, serviceTypeId: value }))}
          serviceTypes={compatibleServiceTypes}
          serviceTypesLoading={serviceTypesLoading}
          disabled={!canEdit}
        />

        <VehicleSection
          vehicleBrand={formData.vehicleBrand}
          onVehicleBrandChange={(value) => setFormData(prev => ({ ...prev, vehicleBrand: value }))}
          vehicleModel={formData.vehicleModel}
          onVehicleModelChange={(value) => setFormData(prev => ({ ...prev, vehicleModel: value }))}
          licensePlate={formData.licensePlate}
          onLicensePlateChange={(value) => setFormData(prev => ({ ...prev, licensePlate: value }))}
          isVehicleInfoOptional={selectedServiceType?.vehicleInfoOptional || false}
          disabled={!canEdit}
        />

        <LocationSection
          origin={formData.origin}
          onOriginChange={(value) => setFormData(prev => ({ ...prev, origin: value }))}
          destination={formData.destination}
          onDestinationChange={(value) => setFormData(prev => ({ ...prev, destination: value }))}
          disabled={!canEdit}
        />

        <ResourceSection
          craneId={formData.craneId}
          onCraneChange={(value) => setFormData(prev => ({ ...prev, craneId: value }))}
          cranes={cranes}
          operatorId={formData.operatorId}
          onOperatorChange={(value) => setFormData(prev => ({ ...prev, operatorId: value }))}
          operators={operators}
          disabled={!canEdit}
        />

        <FinancialSection
          value={formData.value}
          onValueChange={(value) => setFormData(prev => ({ ...prev, value }))}
          operatorCommission={formData.operatorCommission}
          onOperatorCommissionChange={(value) => setFormData(prev => ({ ...prev, operatorCommission: value }))}
          disabled={!canEdit}
        />

        <ObservationsSection
          status={formData.status}
          onStatusChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
          observations={formData.observations}
          onObservationsChange={(value) => setFormData(prev => ({ ...prev, observations: value }))}
          disabled={!canEdit}
        />

        <FormActions 
          onCancel={onCancel} 
          isEditing={!!service} 
          disabled={!canEdit}
        />
      </form>

      {/* Auto-save indicator */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-gray-800/90 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-2">
          <Save className="w-3 h-3" />
          <span>Guardado automático activo</span>
        </div>
      </div>
    </div>
  );
};
