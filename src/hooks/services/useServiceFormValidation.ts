
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

    if (!selectedClient || !selectedServiceType) {
      toast({
        type: "error",
        title: "Error",
        description: "Por favor, selecciona cliente y tipo de servicio",
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

    // Para servicios en estado 'pending', los recursos pueden estar sin asignar
    const isPendingService = service?.status === 'pending' || !service;
    
    // Validación condicional basada en el tipo de servicio
    if (selectedServiceType.craneRequired && !isPendingService) {
      const selectedCrane = cranes.find(c => c.id === formData.craneId);
      if (!selectedCrane && formData.craneId) {
        toast({
          type: "error",
          title: "Error",
          description: "La grúa seleccionada no es válida",
        });
        return { isValid: false };
      }
    }

    if (selectedServiceType.operatorRequired && !isPendingService) {
      const selectedOperator = operators.find(o => o.id === formData.operatorId);
      if (!selectedOperator && formData.operatorId) {
        toast({
          type: "error",
          title: "Error",
          description: "El operador seleccionado no es válido",
        });
        return { isValid: false };
      }
    }

    if (selectedServiceType.originRequired && !formData.origin?.trim()) {
      toast({
        type: "error",
        title: "Error",
        description: "El origen es requerido para este tipo de servicio",
      });
      return { isValid: false };
    }

    if (selectedServiceType.destinationRequired && !formData.destination?.trim()) {
      toast({
        type: "error",
        title: "Error",
        description: "El destino es requerido para este tipo de servicio",
      });
      return { isValid: false };
    }

    if (selectedServiceType.purchaseOrderRequired && !formData.purchaseOrder?.trim()) {
      toast({
        type: "error",
        title: "Error",
        description: "La orden de compra es requerida para este tipo de servicio",
      });
      return { isValid: false };
    }

    // Validación de información del vehículo
    if (selectedServiceType.vehicleBrandRequired && !formData.vehicleBrand?.trim()) {
      toast({
        type: "error",
        title: "Error",
        description: "La marca del vehículo es requerida para este tipo de servicio",
      });
      return { isValid: false };
    }

    if (selectedServiceType.vehicleModelRequired && !formData.vehicleModel?.trim()) {
      toast({
        type: "error",
        title: "Error",
        description: "El modelo del vehículo es requerido para este tipo de servicio",
      });
      return { isValid: false };
    }

    if (selectedServiceType.licensePlateRequired && !formData.licensePlate?.trim()) {
      toast({
        type: "error",
        title: "Error",
        description: "La patente es requerida para este tipo de servicio",
      });
      return { isValid: false };
    }

    return {
      isValid: true,
      selectedClient,
      selectedCrane: cranes.find(c => c.id === formData.craneId),
      selectedOperator: operators.find(o => o.id === formData.operatorId),
      selectedServiceType
    };
  };

  return { validateForm };
};
