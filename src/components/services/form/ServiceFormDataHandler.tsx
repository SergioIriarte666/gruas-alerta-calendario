
import { format } from 'date-fns';

interface FormDataHandlerProps {
  markAsClearing: () => void;
  setFolio: (folio: string) => void;
  setIsManualFolio: (isManual: boolean) => void;
  setFormData: (data: any) => void;
  setRequestDate: (date: Date) => void;
  setServiceDate: (date: Date) => void;
  formData: any;
}

export const useServiceFormDataHandler = ({
  markAsClearing,
  setFolio,
  setIsManualFolio,
  setFormData,
  setRequestDate,
  setServiceDate,
  formData
}: FormDataHandlerProps) => {
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
  };

  return {
    handleDataRestore,
    handleDataClear
  };
};
