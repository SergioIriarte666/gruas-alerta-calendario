
import { useToast } from '@/components/ui/custom-toast';
import { Client, Crane, Operator, ServiceType } from '@/types';
import { useUser } from '@/contexts/UserContext';

export const useServiceFormValidation = () => {
  const { toast } = useToast();
  const { user } = useUser();

  const validateForm = (
    folio: string,
    formData: any,
    clients: Client[],
    cranes: Crane[],
    operators: Operator[],
    serviceTypes: ServiceType[],
    service?: any
  ) => {
    const selectedClient = clients.find(c => c.id === formData.clientId);
    const selectedCrane = cranes.find(c => c.id === formData.craneId);
    const selectedOperator = operators.find(o => o.id === formData.operatorId);
    const selectedServiceType = serviceTypes.find(st => st.id === formData.serviceTypeId);

    // Check if service is invoiced and user is not admin
    if (service?.status === 'invoiced' && user?.role !== 'admin') {
      toast({
        type: "error",
        title: "Error",
        description: "No se puede editar un servicio facturado. Solo los administradores pueden hacerlo.",
      });
      return { isValid: false };
    }

    if (!selectedClient || !selectedCrane || !selectedOperator || !selectedServiceType) {
      toast({
        type: "error",
        title: "Error",
        description: "Por favor, selecciona todos los campos requeridos",
      });
      return { isValid: false };
    }

    if (!folio.trim()) {
      toast({
        type: "error",
        title: "Error",
        description: "El folio es requerido",
      });
      return { isValid: false };
    }

    // Check if vehicle info is required based on database field
    const isVehicleInfoOptional = selectedServiceType.vehicleInfoOptional;

    // Validate vehicle information only if required (not optional)
    if (!isVehicleInfoOptional) {
      if (!formData.vehicleBrand?.trim() || !formData.vehicleModel?.trim() || !formData.licensePlate?.trim()) {
        toast({
          type: "error",
          title: "Error",
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
