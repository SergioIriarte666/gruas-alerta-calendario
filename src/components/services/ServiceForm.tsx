
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

  const compatibleServiceTypes = serviceTypes.map(st => ({
    ...st,
    description: st.description || '',
  }));

  // Get the selected service type for the VehicleSection component
  const selectedServiceType = serviceTypes.find(st => st.id === formData.serviceTypeId);

  return (
    <form onSubmit={(e) => handleSubmit(e, folio, formData, isManualFolio)} className="space-y-6">
      <FolioSection
        folio={folio}
        onFolioChange={setFolio}
        isManualFolio={isManualFolio}
        onManualFolioChange={setIsManualFolio}
        onGenerateNewFolio={handleGenerateNewFolio}
        isEditing={!!service}
        isLoading={folioLoading}
      />

      <DateSection
        requestDate={requestDate}
        serviceDate={serviceDate}
        onRequestDateChange={setRequestDate}
        onServiceDateChange={setServiceDate}
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
      />

      <VehicleSection
        vehicleBrand={formData.vehicleBrand}
        onVehicleBrandChange={(value) => setFormData(prev => ({ ...prev, vehicleBrand: value }))}
        vehicleModel={formData.vehicleModel}
        onVehicleModelChange={(value) => setFormData(prev => ({ ...prev, vehicleModel: value }))}
        licensePlate={formData.licensePlate}
        onLicensePlateChange={(value) => setFormData(prev => ({ ...prev, licensePlate: value }))}
        serviceTypeName={selectedServiceType?.name}
      />

      <LocationSection
        origin={formData.origin}
        onOriginChange={(value) => setFormData(prev => ({ ...prev, origin: value }))}
        destination={formData.destination}
        onDestinationChange={(value) => setFormData(prev => ({ ...prev, destination: value }))}
      />

      <ResourceSection
        craneId={formData.craneId}
        onCraneChange={(value) => setFormData(prev => ({ ...prev, craneId: value }))}
        cranes={cranes}
        operatorId={formData.operatorId}
        onOperatorChange={(value) => setFormData(prev => ({ ...prev, operatorId: value }))}
        operators={operators}
      />

      <FinancialSection
        value={formData.value}
        onValueChange={(value) => setFormData(prev => ({ ...prev, value }))}
        operatorCommission={formData.operatorCommission}
        onOperatorCommissionChange={(value) => setFormData(prev => ({ ...prev, operatorCommission: value }))}
      />

      <ObservationsSection
        status={formData.status}
        onStatusChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
        observations={formData.observations}
        onObservationsChange={(value) => setFormData(prev => ({ ...prev, observations: value }))}
      />

      <FormActions onCancel={onCancel} isEditing={!!service} />
    </form>
  );
};
