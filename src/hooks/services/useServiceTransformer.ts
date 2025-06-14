
import { Service, ServiceStatus } from '@/types';

export const useServiceTransformer = () => {
  const transformRawServiceData = (data: any[]): Service[] => {
    return data.map(service => {
      try {
        return {
          id: service.id,
          folio: service.folio,
          requestDate: service.request_date,
          serviceDate: service.service_date,
          client: {
            id: service.clients.id,
            name: service.clients.name,
            rut: service.clients.rut,
            phone: service.clients.phone || '',
            email: service.clients.email || '',
            address: service.clients.address || '',
            isActive: service.clients.is_active,
            createdAt: '',
            updatedAt: ''
          },
          purchaseOrder: service.purchase_order,
          vehicleBrand: service.vehicle_brand,
          vehicleModel: service.vehicle_model,
          licensePlate: service.license_plate,
          origin: service.origin,
          destination: service.destination,
          serviceType: {
            id: service.service_types.id,
            name: service.service_types.name,
            description: service.service_types.description || '',
            isActive: service.service_types.is_active,
            createdAt: '',
            updatedAt: ''
          },
          value: Number(service.value),
          crane: {
            id: service.cranes.id,
            licensePlate: service.cranes.license_plate,
            brand: service.cranes.brand,
            model: service.cranes.model,
            type: service.cranes.type,
            isActive: service.cranes.is_active,
            createdAt: '',
            updatedAt: '',
            circulationPermitExpiry: '',
            insuranceExpiry: '',
            technicalReviewExpiry: ''
          },
          operator: {
            id: service.operators.id,
            name: service.operators.name,
            rut: service.operators.rut,
            phone: service.operators.phone || '',
            licenseNumber: service.operators.license_number,
            isActive: service.operators.is_active,
            createdAt: '',
            updatedAt: '',
            examExpiry: ''
          },
          operatorCommission: Number(service.operator_commission),
          status: service.status as ServiceStatus,
          observations: service.observations,
          createdAt: service.created_at,
          updatedAt: service.updated_at
        };
      } catch (formatError) {
        console.error('Error formatting service:', service, formatError);
        throw formatError;
      }
    });
  };

  return {
    transformRawServiceData
  };
};
