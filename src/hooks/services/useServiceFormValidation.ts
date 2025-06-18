
import { toast } from 'sonner';
import { Client, Crane, Operator, ServiceType } from '@/types';

export const useServiceFormValidation = () => {
  const validateForm = (
    folio: string,
    formData: any,
    clients: Client[],
    cranes: Crane[],
    operators: Operator[],
    serviceTypes: ServiceType[]
  ) => {
    const selectedClient = clients.find(c => c.id === formData.clientId);
    const selectedCrane = cranes.find(c => c.id === formData.craneId);
    const selectedOperator = operators.find(o => o.id === formData.operatorId);
    const selectedServiceType = serviceTypes.find(st => st.id === formData.serviceTypeId);

    if (!selectedClient || !selectedCrane || !selectedOperator || !selectedServiceType) {
      toast.error("Error", {
        description: "Por favor, selecciona todos los campos requeridos",
      });
      return { isValid: false };
    }

    if (!folio.trim()) {
      toast.error("Error", {
        description: "El folio es requerido",
      });
      return { isValid: false };
    }

    // Check if vehicle info is required for this service type
    const isVehicleInfoOptional = selectedServiceType.name.toLowerCase().includes('taxi') ||
                                  selectedServiceType.name.toLowerCase().includes('transporte de materiales') ||
                                  selectedServiceType.name.toLowerCase().includes('transporte de suministros');

    // Validate vehicle information if required
    if (!isVehicleInfoOptional) {
      if (!formData.vehicleBrand.trim() || !formData.vehicleModel.trim() || !formData.licensePlate.trim()) {
        toast.error("Error", {
          description: "La información del vehículo es requerida para este tipo de servicio",
        });
        return { isValid: false };
      }
    }

    return {
      isValid: true,
      selectedClient,
      selectedCrane,
      selectedOperator,
      selectedServiceType
    };
  };

  return { validateForm };
};
