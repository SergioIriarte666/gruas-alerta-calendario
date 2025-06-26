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
import { ServiceFormHeader } from './form/ServiceFormHeader';
import { ServiceFormPersistence } from './form/ServiceFormPersistence';
import { useServiceFormData } from '@/hooks/services/useServiceFormData';
import { useServiceFormEffects } from '@/hooks/services/useServiceFormEffects';
import { useServiceFormSubmission } from '@/hooks/services/useServiceFormSubmission';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';
import { useRef } from 'react';
import { format } from 'date-fns';

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
  const markAsSubmittedRef = useRef<(() => void) | null>(null);

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

  const { handleGenerateNewFolio, folioLoading, markAsClearing } = useServiceFormEffects(
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

  const handleDataRestore = (data: any) => {
    console.log('📥 Restoring form data:', data);
    setFolio(data.folio || '');
    setIsManualFolio(data.isManualFolio || false);
    setFormData(data.formData || formData);
    if (data.requestDate) setRequestDate(new Date(data.requestDate));
    if (data.serviceDate) setServiceDate(new Date(data.serviceDate));
  };

  const handleDataClear = () => {
    console.log('🧹 Clearing form data completely');
    
    // Marcar que estamos limpiando para evitar generación automática de folio
    markAsClearing();
    
    // Guardar el estado actual de isManualFolio para mantenerlo
    const currentIsManualFolio = isManualFolio;
    
    // Resetear todos los campos del formulario a sus valores por defecto
    setFolio('');
    setIsManualFolio(false); // Resetear a automático por defecto
    setFormData({
      requestDate: format(new Date(), 'yyyy-MM-dd'),
      serviceDate: format(new Date(), 'yyyy-MM-dd'),
      clientId: '',
      purchaseOrder: '',
      vehicleBrand: '',
      vehicleModel: '',
      licensePlate: '',
      origin: '',
      destination: '',
      serviceTypeId: '',
      value: 0,
      craneId: '',
      operatorId: '',
      operatorCommission: 0,
      status: 'pending' as const,
      observations: ''
    });
    setRequestDate(new Date());
    setServiceDate(new Date());
    
    // Solo generar nuevo folio si no era manual antes de limpiar
    if (!currentIsManualFolio) {
      console.log('🔢 Generating new folio after clear (was automatic)');
      setTimeout(() => {
        handleGenerateNewFolio();
      }, 100); // Pequeño delay para asegurar que el estado se actualice
    } else {
      console.log('📝 Keeping empty folio (was manual)');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    try {
      await handleSubmit(e, folio, formData, isManualFolio);
      
      // Limpiar datos de persistencia después del envío exitoso
      if (markAsSubmittedRef.current) {
        markAsSubmittedRef.current();
      }
      
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

  const compatibleServiceTypes = serviceTypes.map(st => ({
    ...st,
    description: st.description || '',
  }));

  const selectedServiceType = serviceTypes.find(st => st.id === formData.serviceTypeId);
  
  const isInvoiced = service?.status === 'invoiced';
  const isAdmin = user?.role === 'admin';
  const canEdit = !isInvoiced || isAdmin;

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
    </div>
  );
};
