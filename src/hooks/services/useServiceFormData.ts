
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Service } from '@/types';

export const useServiceFormData = (service?: Service | null) => {
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
