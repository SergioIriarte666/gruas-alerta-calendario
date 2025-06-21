
import { Service } from '@/types';
import { toast } from 'sonner';
import { useFolioGenerator } from '@/hooks/useFolioGenerator';
import { useServiceFormValidation } from './useServiceFormValidation';

interface UseServiceFormSubmissionProps {
  service?: Service | null;
  onSubmit: (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'> & { folio: string }) => void;
  clients: any[];
  cranes: any[];
  operators: any[];
  serviceTypes: any[];
}

export const useServiceFormSubmission = ({
  service,
  onSubmit,
  clients,
  cranes,
  operators,
  serviceTypes
}: UseServiceFormSubmissionProps) => {
  const { validateFolioUniqueness, syncFolioCounter } = useFolioGenerator();
  const { validateForm } = useServiceFormValidation();

  const handleSubmit = async (
    e: React.FormEvent,
    folio: string,
    formData: any,
    isManualFolio: boolean
  ) => {
    e.preventDefault();
    
    const validation = validateForm(folio, formData, clients, cranes, operators, serviceTypes, service);
    
    if (!validation.isValid) {
      return;
    }

    const { selectedClient, selectedCrane, selectedOperator, selectedServiceType } = validation;

    // Validar unicidad del folio solo si es manual o estamos creando un nuevo servicio
    if ((isManualFolio || !service) && service?.folio !== folio) {
      const isUnique = await validateFolioUniqueness(folio);
      if (!isUnique) {
        toast.error("Error", {
          description: "Este folio ya existe. Por favor, usa un folio diferente.",
        });
        return;
      }

      // Si es un folio manual y es único, sincronizar el contador
      if (isManualFolio && !service) {
        await syncFolioCounter(folio);
      }
    }

    // Preparar datos según los requerimientos del tipo de servicio
    const submissionData = {
      folio,
      requestDate: formData.requestDate,
      serviceDate: formData.serviceDate,
      client: selectedClient,
      purchaseOrder: selectedServiceType.purchaseOrderRequired ? formData.purchaseOrder : (formData.purchaseOrder || null),
      vehicleBrand: selectedServiceType.vehicleBrandRequired ? formData.vehicleBrand : (formData.vehicleBrand || null),
      vehicleModel: selectedServiceType.vehicleModelRequired ? formData.vehicleModel : (formData.vehicleModel || null),
      licensePlate: selectedServiceType.licensePlateRequired ? formData.licensePlate : (formData.licensePlate || null),
      origin: selectedServiceType.originRequired ? formData.origin : (formData.origin || null),
      destination: selectedServiceType.destinationRequired ? formData.destination : (formData.destination || null),
      serviceType: {
        id: selectedServiceType.id,
        name: selectedServiceType.name,
        description: selectedServiceType.description || '',
        isActive: selectedServiceType.isActive,
        createdAt: selectedServiceType.createdAt,
        updatedAt: selectedServiceType.updatedAt
      },
      value: formData.value,
      crane: selectedCrane || null,
      operator: selectedOperator || null,
      operatorCommission: formData.operatorCommission || 0,
      status: formData.status,
      observations: formData.observations || null
    };

    console.log('Submitting service data:', submissionData);
    onSubmit(submissionData);
  };

  return { handleSubmit };
};
