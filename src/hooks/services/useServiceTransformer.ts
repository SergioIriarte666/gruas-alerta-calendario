
import { Service, ServiceStatus } from '@/types';

export const useServiceTransformer = () => {
  const transformRawServiceData = (data: any[]): Service[] => {
    console.log('🔄 Transforming', data.length, 'services');
    
    return data.map((service) => {
      console.log(`🔄 Processing service:`, service.folio);

      const transformedService: Service = {
        id: service.id,
        folio: service.folio || 'SIN-FOLIO',
        requestDate: service.request_date,
        serviceDate: service.service_date,
        
        client: service.clients ? {
          id: service.clients.id,
          name: service.clients.name || 'Cliente sin nombre',
          rut: service.clients.rut || '',
          phone: service.clients.phone || '',
          email: service.clients.email || '',
          address: service.clients.address || '',
          isActive: service.clients.is_active ?? true,
          createdAt: service.clients.created_at || '',
          updatedAt: service.clients.updated_at || ''
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
        
        purchaseOrder: service.purchase_order || null,
        vehicleBrand: service.vehicle_brand || '',
        vehicleModel: service.vehicle_model || '',
        licensePlate: service.license_plate || '',
        origin: service.origin || '',
        destination: service.destination || '',
        
        serviceType: service.service_types ? {
          id: service.service_types.id,
          name: service.service_types.name || 'Tipo no especificado',
          description: service.service_types.description || '',
          basePrice: Number(service.service_types.base_price) || 0,
          isActive: service.service_types.is_active ?? true,
          vehicleInfoOptional: service.service_types.vehicle_info_optional ?? false,
          purchaseOrderRequired: service.service_types.purchase_order_required ?? false,
          originRequired: service.service_types.origin_required ?? true,
          destinationRequired: service.service_types.destination_required ?? true,
          craneRequired: service.service_types.crane_required ?? true,
          operatorRequired: service.service_types.operator_required ?? true,
          vehicleBrandRequired: service.service_types.vehicle_brand_required ?? true,
          vehicleModelRequired: service.service_types.vehicle_model_required ?? true,
          licensePlateRequired: service.service_types.license_plate_required ?? true,
          createdAt: service.service_types.created_at || '',
          updatedAt: service.service_types.updated_at || ''
        } : {
          id: 'unknown',
          name: 'Tipo no especificado',
          description: '',
          basePrice: 0,
          isActive: true,
          vehicleInfoOptional: false,
          purchaseOrderRequired: false,
          originRequired: true,
          destinationRequired: true,
          craneRequired: true,
          operatorRequired: true,
          vehicleBrandRequired: true,
          vehicleModelRequired: true,
          licensePlateRequired: true,
          createdAt: '',
          updatedAt: ''
        },
        
        value: Number(service.value) || 0,
        
        crane: service.cranes ? {
          id: service.cranes.id,
          licensePlate: service.cranes.license_plate || 'N/A',
          brand: service.cranes.brand || 'N/A',
          model: service.cranes.model || 'N/A',
          type: service.cranes.type || 'telescopic',
          isActive: service.cranes.is_active ?? true,
          createdAt: service.cranes.created_at || '',
          updatedAt: service.cranes.updated_at || '',
          circulationPermitExpiry: service.cranes.circulation_permit_expiry || '',
          insuranceExpiry: service.cranes.insurance_expiry || '',
          technicalReviewExpiry: service.cranes.technical_review_expiry || ''
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
          name: service.operators.name || 'Operador sin nombre',
          rut: service.operators.rut || '',
          phone: service.operators.phone || '',
          licenseNumber: service.operators.license_number || '',
          isActive: service.operators.is_active ?? true,
          createdAt: service.operators.created_at || '',
          updatedAt: service.operators.updated_at || '',
          examExpiry: service.operators.exam_expiry || ''
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
        status: service.status as ServiceStatus || 'pending',
        observations: service.observations || null,
        createdAt: service.created_at,
        updatedAt: service.updated_at
      };

      console.log('✅ Service transformed:', transformedService.folio);
      return transformedService;
    });
  };

  return {
    transformRawServiceData
  };
};
