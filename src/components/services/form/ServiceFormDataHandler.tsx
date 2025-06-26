
import { 
  getCurrentChileDate, 
  formatForInput, 
  parseFromInput,
  toChileTime
} from '@/utils/timezoneUtils';

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
    
    // Parse dates ensuring Chile timezone
    if (data.requestDate) {
      setRequestDate(typeof data.requestDate === 'string' ? parseFromInput(data.requestDate) : toChileTime(data.requestDate));
    }
    if (data.serviceDate) {
      setServiceDate(typeof data.serviceDate === 'string' ? parseFromInput(data.serviceDate) : toChileTime(data.serviceDate));
    }
  };

  const handleDataClear = () => {
    console.log('🧹 Clearing form data completely');
    
    // Marcar que estamos limpiando para evitar generación automática de folio
    markAsClearing();
    
    // Get current date in Chile timezone
    const currentDate = getCurrentChileDate();
    
    // Resetear todos los campos del formulario a sus valores por defecto
    setFolio('');
    setIsManualFolio(false); // Resetear a automático por defecto
    setFormData({
      requestDate: formatForInput(currentDate),
      serviceDate: formatForInput(currentDate),
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
    setRequestDate(currentDate);
    setServiceDate(currentDate);
  };

  return {
    handleDataRestore,
    handleDataClear
  };
};
