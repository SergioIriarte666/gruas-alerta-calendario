
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
import { ServiceFormHeader } from './form/ServiceFormHeader';
import { ServiceFormPersistence } from './form/ServiceFormPersistence';
import { ServiceFormSubmissionHandler } from './form/ServiceFormSubmissionHandler';
import { useServiceFormContainer } from '@/hooks/services/useServiceFormContainer';
import { useServiceFormDataHandler } from './form/ServiceFormDataHandler';

interface ServiceFormProps {
  service?: Service | null;
  onSubmit: (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'> & { folio: string }) => void;
  onCancel: () => void;
}

export const ServiceForm = ({ service, onSubmit, onCancel }: ServiceFormProps) => {
  const {
    clients,
    cranes,
    operators,
    serviceTypes,
    serviceTypesLoading,
    selectedServiceType,
    isManualFolio,
    setIsManualFolio,
    folio,
    setFolio,
    formData,
    setFormData,
    requestDate,
    setRequestDate,
    serviceDate,
    setServiceDate,
    handleGenerateNewFolio,
    folioLoading,
    markAsClearing,
    handleSubmit,
    canEdit,
    markAsSubmittedRef,
    toast
  } = useServiceFormContainer({ service, onSubmit });

  const { handleDataRestore, handleDataClear } = useServiceFormDataHandler({
    markAsClearing,
    setFolio,
    setIsManualFolio,
    setFormData,
    setRequestDate,
    setServiceDate,
    formData
  });

  return (
    <div className="space-y-6">
      <ServiceFormPersistence
        service={service}
        folio={folio}
        isManualFolio={isManualFolio}
        formData={formData}
        requestDate={requestDate}
        serviceDate={serviceDate}
        onDataRestore={handleDataRestore}
        onDataClear={handleDataClear}
        onMarkAsSubmitted={(fn) => markAsSubmittedRef.current = fn}
      />

      <ServiceFormHeader service={service} />

      <ServiceFormSubmissionHandler
        handleSubmit={handleSubmit}
        folio={folio}
        formData={formData}
        isManualFolio={isManualFolio}
        markAsSubmittedRef={markAsSubmittedRef}
        toast={toast}
      >
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
          serviceTypes={serviceTypes}
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
      </ServiceFormSubmissionHandler>
    </div>
  );
};
