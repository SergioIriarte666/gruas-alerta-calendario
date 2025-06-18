
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
  const { validateFolioUniqueness } = useFolioGenerator();
  const { validateForm } = useServiceFormValidation();

  const handleSubmit = async (
    e: React.FormEvent,
    folio: string,
    formData: any,
    isManualFolio: boolean
  ) => {
    e.preventDefault();
    
    const validation = validateForm(folio, formData, clients, cranes, operators, serviceTypes);
    
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
    }

    onSubmit({
      folio,
      requestDate: formData.requestDate,
      serviceDate: formData.serviceDate,
      client: selectedClient,
      purchaseOrder: formData.purchaseOrder,
      vehicleBrand: formData.vehicleBrand || '',
      vehicleModel: formData.vehicleModel || '',
      licensePlate: formData.licensePlate || '',
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

  return { handleSubmit };
};
