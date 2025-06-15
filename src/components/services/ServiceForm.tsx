import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Service } from '@/types';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { useFolioGenerator } from '@/hooks/useFolioGenerator';
import { useToast } from '@/hooks/use-toast';
import { FolioSection } from './form/FolioSection';
import { DateSection } from './form/DateSection';
import { ClientServiceSection } from './form/ClientServiceSection';
import { VehicleSection } from './form/VehicleSection';
import { LocationSection } from './form/LocationSection';
import { ResourceSection } from './form/ResourceSection';
import { FinancialSection } from './form/FinancialSection';
import { ObservationsSection } from './form/ObservationsSection';
import { FormActions } from './form/FormActions';

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
  const { generateNextFolio, validateFolioUniqueness, loading: folioLoading } = useFolioGenerator();
  const { toast } = useToast();

  const [isManualFolio, setIsManualFolio] = useState(false);
  const [folio, setFolio] = useState(service?.folio || '');

  const [formData, setFormData] = useState({
    requestDate: service?.requestDate || format(new Date(), 'yyyy-MM-dd'),
    serviceDate: service?.serviceDate || format(new Date(), 'yyyy-MM-dd'),
    clientId: service?.client.id || '',
    purchaseOrder: service?.purchaseOrder || '',
    vehicleBrand: service?.vehicleBrand || '',
    vehicleModel: service?.vehicleModel || '',
    licensePlate: service?.licensePlate || '',
    origin: service?.origin || '',
    destination: service?.destination || '',
    serviceTypeId: service?.serviceType.id || '',
    value: service?.value || 0,
    craneId: service?.crane.id || '',
    operatorId: service?.operator.id || '',
    operatorCommission: service?.operatorCommission || 0,
    status: service?.status || 'pending' as const,
    observations: service?.observations || ''
  });

  const [requestDate, setRequestDate] = useState<Date>(
    service?.requestDate ? new Date(service.requestDate) : new Date()
  );
  const [serviceDate, setServiceDate] = useState<Date>(
    service?.serviceDate ? new Date(service.serviceDate) : new Date()
  );

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      requestDate: format(requestDate, 'yyyy-MM-dd'),
      serviceDate: format(serviceDate, 'yyyy-MM-dd')
    }));
  }, [requestDate, serviceDate]);

  // Generar folio automático cuando no es manual y no estamos editando
  useEffect(() => {
    if (!isManualFolio && !service) {
      generateNextFolio().then(setFolio);
    }
  }, [isManualFolio, service, generateNextFolio]);

  const handleGenerateNewFolio = async () => {
    const newFolio = await generateNextFolio();
    setFolio(newFolio);
  };

  const compatibleServiceTypes = serviceTypes.map(st => ({
    ...st,
    description: st.description || '',
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedClient = clients.find(c => c.id === formData.clientId);
    const selectedCrane = cranes.find(c => c.id === formData.craneId);
    const selectedOperator = operators.find(o => o.id === formData.operatorId);
    const selectedServiceType = serviceTypes.find(st => st.id === formData.serviceTypeId);

    if (!selectedClient || !selectedCrane || !selectedOperator || !selectedServiceType) {
      toast({
        title: "Error",
        description: "Por favor, selecciona todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    if (!folio.trim()) {
      toast({
        title: "Error",
        description: "El folio es requerido",
        variant: "destructive",
      });
      return;
    }

    // Validar unicidad del folio solo si es manual o estamos creando un nuevo servicio
    if ((isManualFolio || !service) && service?.folio !== folio) {
      const isUnique = await validateFolioUniqueness(folio);
      if (!isUnique) {
        toast({
          title: "Error",
          description: "Este folio ya existe. Por favor, usa un folio diferente.",
          variant: "destructive",
        });
        return;
      }
    }

    onSubmit({
      folio,
      requestDate: formData.requestDate,
      serviceDate: formData.serviceDate,
      client: selectedClient,
      purchaseOrder: formData.purchaseOrder,
      vehicleBrand: formData.vehicleBrand,
      vehicleModel: formData.vehicleModel,
      licensePlate: formData.licensePlate,
      origin: formData.origin,
      destination: formData.destination,
      serviceType: {
        id: selectedServiceType.id,
        name: selectedServiceType.name,
        description: selectedServiceType.description || '',
        isActive: selectedServiceType.isActive,
        createdAt: selectedServiceType.createdAt,
        updatedAt: selectedServiceType.updatedAt
      },
      value: formData.value,
      crane: selectedCrane,
      operator: selectedOperator,
      operatorCommission: formData.operatorCommission,
      status: formData.status,
      observations: formData.observations
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
