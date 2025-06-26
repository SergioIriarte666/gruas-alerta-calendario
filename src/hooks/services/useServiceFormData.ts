
import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { 
  getCurrentChileDate, 
  formatForInput, 
  parseFromInput,
  toChileTime
} from '@/utils/timezoneUtils';

export const useServiceFormData = (service?: Service | null) => {
  const [isManualFolio, setIsManualFolio] = useState(false);
  const [folio, setFolio] = useState(service?.folio || '');

  // Initialize dates in Chile timezone
  const currentDate = getCurrentChileDate();
  
  const [formData, setFormData] = useState({
    requestDate: service?.requestDate || formatForInput(currentDate),
    serviceDate: service?.serviceDate || formatForInput(currentDate),
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
    service?.requestDate ? toChileTime(service.requestDate) : currentDate
  );
  const [serviceDate, setServiceDate] = useState<Date>(
    service?.serviceDate ? toChileTime(service.serviceDate) : currentDate
  );

  // Update form data when dates change, ensuring Chile timezone
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      requestDate: formatForInput(requestDate),
      serviceDate: formatForInput(serviceDate)
    }));
  }, [requestDate, serviceDate]);

  return {
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
  };
};
