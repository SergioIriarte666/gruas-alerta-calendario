
import { useMemo } from 'react';
import { Service } from '@/types';

export const useServiceTransformer = () => {
  const transformRawServiceData = useMemo(() => (data: any[]): Service[] => {
    console.log('🔄 Transforming', data.length, 'services');
    
    return data.map((item: any) => {
      console.log('🔄 Processing service:', item.folio);
      
      const transformedService: Service = {
        id: item.id,
        folio: item.folio,
        requestDate: item.request_date,
        serviceDate: item.service_date,
        client: {
          id: item.clients?.id || item.client_id,
          name: item.clients?.name || 'Cliente no disponible',
          rut: item.clients?.rut || '',
          phone: item.clients?.phone || '',
          email: item.clients?.email || '',
          address: item.clients?.address || '',
          isActive: item.clients?.is_active ?? true,
          createdAt: item.clients?.created_at || new Date().toISOString(),
          updatedAt: item.clients?.updated_at || new Date().toISOString()
        },
        serviceType: {
          id: item.service_types?.id || item.service_type_id,
          name: item.service_types?.name || 'Tipo no disponible',
          description: item.service_types?.description || '',
          basePrice: item.service_types?.base_price || null,
          isActive: item.service_types?.is_active ?? true,
          vehicleInfoOptional: item.service_types?.vehicle_info_optional || false,
          purchaseOrderRequired: item.service_types?.purchase_order_required || false,
          originRequired: item.service_types?.origin_required !== false,
          destinationRequired: item.service_types?.destination_required !== false,
          craneRequired: item.service_types?.crane_required !== false,
          operatorRequired: item.service_types?.operator_required !== false,
          vehicleBrandRequired: item.service_types?.vehicle_brand_required !== false,
          vehicleModelRequired: item.service_types?.vehicle_model_required !== false,
          licensePlateRequired: item.service_types?.license_plate_required !== false,
          createdAt: item.service_types?.created_at || new Date().toISOString(),
          updatedAt: item.service_types?.updated_at || new Date().toISOString()
        },
        crane: {
          id: item.cranes?.id || item.crane_id,
          licensePlate: item.cranes?.license_plate || 'N/A',
          brand: item.cranes?.brand || 'N/A',
          model: item.cranes?.model || 'N/A',
          type: item.cranes?.type || 'mobile',
          isActive: item.cranes?.is_active ?? true,
          circulationPermitExpiry: item.cranes?.circulation_permit_expiry || new Date().toISOString().split('T')[0],
          insuranceExpiry: item.cranes?.insurance_expiry || new Date().toISOString().split('T')[0],
          technicalReviewExpiry: item.cranes?.technical_review_expiry || new Date().toISOString().split('T')[0],
          createdAt: item.cranes?.created_at || new Date().toISOString(),
          updatedAt: item.cranes?.updated_at || new Date().toISOString()
        },
        operator: {
          id: item.operators?.id || item.operator_id,
          name: item.operators?.name || 'Operador no disponible',
          rut: item.operators?.rut || '',
          phone: item.operators?.phone || '',
          licenseNumber: item.operators?.license_number || '',
          isActive: item.operators?.is_active ?? true,
          examExpiry: item.operators?.exam_expiry || new Date().toISOString().split('T')[0],
          createdAt: item.operators?.created_at || new Date().toISOString(),
          updatedAt: item.operators?.updated_at || new Date().toISOString()
        },
        vehicleBrand: item.vehicle_brand || '',
        vehicleModel: item.vehicle_model || '',
        licensePlate: item.license_plate || '',
        origin: item.origin || '',
        destination: item.destination || '',
        value: parseFloat(item.value) || 0,
        operatorCommission: parseFloat(item.operator_commission) || 0,
        status: item.status || 'pending',
        observations: item.observations || '',
        purchaseOrder: item.purchase_order || '',
        createdAt: item.created_at,
        updatedAt: item.updated_at
      };
      
      console.log('✅ Service transformed:', transformedService.folio);
      return transformedService;
    });
  }, []);

  return { transformRawServiceData };
};
