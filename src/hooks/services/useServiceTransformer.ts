
import { Service, ServiceStatus } from '@/types';

export const useServiceTransformer = () => {
  const transformRawServiceData = (data: any[]): Service[] => {
    console.log('🔄 transformRawServiceData - Processing', data.length, 'raw services');
    
    return data.map((service, index) => {
      try {
        console.log(`🔄 Processing service ${index + 1}:`, {
          id: service.id,
          folio: service.folio,
          client: service.clients?.name,
          operator: service.operators?.name,
          crane: service.cranes?.license_plate,
          serviceType: service.service_types?.name
        });

        // Validar relaciones requeridas
        if (!service.clients) {
          console.warn(`⚠️ Service ${service.folio} missing client data`);
        }
        if (!service.operators) {
          console.warn(`⚠️ Service ${service.folio} missing operator data`);
        }
        if (!service.cranes) {
          console.warn(`⚠️ Service ${service.folio} missing crane data`);
        }
        if (!service.service_types) {
          console.warn(`⚠️ Service ${service.folio} missing service type data`);
        }

        return {
          id: service.id,
          folio: service.folio,
          requestDate: service.request_date,
          serviceDate: service.service_date,
          client: service.clients ? {
            id: service.clients.id,
            name: service.clients.name,
            rut: service.clients.rut || '',
            phone: service.clients.phone || '',
            email: service.clients.email || '',
            address: service.clients.address || '',
            isActive: service.clients.is_active ?? true,
            createdAt: '',
            updatedAt: ''
          } : {
            id: 'unknown',
            name: 'Cliente no especificado',
            rut: '',
            phone: '',
            email: '',
            address: '',
            isActive: true,
            createdAt: '',
            updatedAt: ''
          },
          purchaseOrder: service.purchase_order,
          vehicleBrand: service.vehicle_brand || '',
          vehicleModel: service.vehicle_model || '',
          licensePlate: service.license_plate || '',
          origin: service.origin,
          destination: service.destination,
          serviceType: service.service_types ? {
            id: service.service_types.id,
            name: service.service_types.name,
            description: service.service_types.description || '',
            isActive: service.service_types.is_active ?? true,
            createdAt: '',
            updatedAt: ''
          } : {
            id: 'unknown',
            name: 'Tipo no especificado',
            description: '',
            isActive: true,
            createdAt: '',
            updatedAt: ''
          },
          value: Number(service.value) || 0,
          crane: service.cranes ? {
            id: service.cranes.id,
            licensePlate: service.cranes.license_plate,
            brand: service.cranes.brand,
            model: service.cranes.model,
            type: service.cranes.type,
            isActive: service.cranes.is_active ?? true,
            createdAt: '',
            updatedAt: '',
            circulationPermitExpiry: '',
            insuranceExpiry: '',
            technicalReviewExpiry: ''
          } : {
            id: 'unknown',
            licensePlate: 'N/A',
            brand: 'N/A',
            model: 'N/A',
            type: 'telescopic',
            isActive: true,
            createdAt: '',
            updatedAt: '',
            circulationPermitExpiry: '',
            insuranceExpiry: '',
            technicalReviewExpiry: ''
          },
          operator: service.operators ? {
            id: service.operators.id,
            name: service.operators.name,
            rut: service.operators.rut,
            phone: service.operators.phone || '',
            licenseNumber: service.operators.license_number,
            isActive: service.operators.is_active ?? true,
            createdAt: '',
            updatedAt: '',
            examExpiry: ''
          } : {
            id: 'unknown',
            name: 'Operador no especificado',
            rut: '',
            phone: '',
            licenseNumber: '',
            isActive: true,
            createdAt: '',
            updatedAt: '',
            examExpiry: ''
          },
          operatorCommission: Number(service.operator_commission) || 0,
          status: service.status as ServiceStatus,
          observations: service.observations,
          createdAt: service.created_at,
          updatedAt: service.updated_at
        };
      } catch (formatError) {
        console.error('❌ Error formatting service:', service.folio || service.id, formatError);
        throw formatError;
      }
    });
  };

  return {
    transformRawServiceData
  };
};
