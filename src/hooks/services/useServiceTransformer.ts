
import { useMemo } from 'react';
import { Service } from '@/types';

export const useServiceTransformer = () => {
  const transformRawServiceData = useMemo(() => (data: any[]): Service[] => {
    console.log('🔄 Transforming', data.length, 'services');
    
    return data.map((item: any) => {
      console.log('🔄 Processing service:', item.folio);
      console.log('🔄 Custody data from DB:', {
        custody_mode: item.custody_mode,
        custody_days: item.custody_days,
        custody_daily_rate: item.custody_daily_rate,
        custody_total_amount: item.custody_total_amount,
        custody_start_date: item.custody_start_date,
        custody_end_date: item.custody_end_date,
        custody_vehicle_type: item.custody_vehicle_type
      });
      
      const transformedService: Service = {
        id: item.id,
        folio: item.folio,
        requestDate: item.request_date,
        serviceDate: item.service_date,
        client: item.client ? {
          id: item.client.id,
          name: item.client.name,
          rut: item.client.rut || '',
          phone: item.client.phone || '',
          email: item.client.email || '',
          address: item.client.address || '',
          department: item.client.department || '',
          isActive: item.client.is_active ?? true,
          createdAt: item.client.created_at || new Date().toISOString(),
          updatedAt: item.client.updated_at || new Date().toISOString()
        } : item.third_party_client ? {
          id: item.third_party_client.id,
          name: item.third_party_client.name,
          rut: item.third_party_client.rut || '',
          phone: item.third_party_client.phone || '',
          email: item.third_party_client.email || '',
          address: item.third_party_client.address || '',
          department: item.third_party_client.department || '',
          isActive: item.third_party_client.is_active ?? true,
          createdAt: item.third_party_client.created_at || new Date().toISOString(),
          updatedAt: item.third_party_client.updated_at || new Date().toISOString()
        } : {
          id: item.client_id || '',
          name: 'Cliente no disponible',
          rut: '',
          phone: '',
          email: '',
          address: '',
          department: '',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        serviceType: item.service_types ? {
          id: item.service_types.id,
          name: item.service_types.name,
          description: item.service_types.description || '',
          basePrice: item.service_types.base_price || null,
          isActive: item.service_types.is_active ?? true,
          vehicleInfoOptional: item.service_types.vehicle_info_optional || false,
          purchaseOrderRequired: item.service_types.purchase_order_required || false,
          originRequired: item.service_types.origin_required !== false,
          destinationRequired: item.service_types.destination_required !== false,
          craneRequired: item.service_types.crane_required !== false,
          operatorRequired: item.service_types.operator_required !== false,
          vehicleBrandRequired: item.service_types.vehicle_brand_required !== false,
          vehicleModelRequired: item.service_types.vehicle_model_required !== false,
          licensePlateRequired: item.service_types.license_plate_required !== false,
          createdAt: item.service_types.created_at || new Date().toISOString(),
          updatedAt: item.service_types.updated_at || new Date().toISOString()
        } : {
          id: item.service_type_id || '',
          name: 'Tipo no disponible',
          description: '',
          basePrice: null,
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        crane: item.cranes ? {
          id: item.cranes.id,
          licensePlate: item.cranes.license_plate,
          brand: item.cranes.brand,
          model: item.cranes.model,
          type: item.cranes.type,
          isActive: item.cranes.is_active,
          circulationPermitExpiry: item.cranes.circulation_permit_expiry,
          insuranceExpiry: item.cranes.insurance_expiry,
          technicalReviewExpiry: item.cranes.technical_review_expiry,
          createdAt: item.cranes.created_at,
          updatedAt: item.cranes.updated_at
        } : null,
        operator: item.operators ? {
          id: item.operators.id,
          name: item.operators.name,
          rut: item.operators.rut,
          phone: item.operators.phone,
          operatorType: (item.operators.operator_type as 'crane_operator' | 'administrative') || 'crane_operator',
          department: item.operators.department,
          position: item.operators.position,
          licenseNumber: item.operators.license_number,
          isActive: item.operators.is_active,
          examExpiry: item.operators.exam_expiry,
          createdAt: item.operators.created_at,
          updatedAt: item.operators.updated_at
        } : null,
        vehicleBrand: item.vehicle_brand || '',
        vehicleModel: item.vehicle_model || '',
        licensePlate: item.license_plate || '',
        // Optional service timing and mileage fields
        startTime: item.start_time || undefined,
        endTime: item.end_time || undefined,
        craneMileage: item.crane_mileage || undefined,
        origin: item.origin || '',
        destination: item.destination || '',
        value: parseFloat(item.value) || 0,
        operatorCommission: parseFloat(item.operator_commission) || 0,
        status: item.status || 'pending',
        observations: item.observations || '',
        purchaseOrder: item.purchase_order || '',
        purchaseOrderNumber: item.purchase_order_number || '',
        quoteNumber: item.quote_number || '',
        // Optional excess functionality
        hasExcess: item.has_excess || false,
        clientCoveredAmount: item.client_covered_amount ?? null, // Preserve null values for proper excess calculation
        excessAmount: item.excess_amount || 0,
        // Invoice information
        invoiceFolio: item.invoice_folio || undefined,
        invoiceNumeroFiscal: item.invoice_numero_fiscal || undefined,
        // Custody fields - Transform from snake_case to camelCase
        custodyMode: item.custody_mode || 'none',
        custodyDays: item.custody_days || 0,
        custodyDailyRate: parseFloat(item.custody_daily_rate) || 0,
        custodyTotalAmount: parseFloat(item.custody_total_amount) || 0,
        custodyStartDate: item.custody_start_date || null,
        custodyEndDate: item.custody_end_date || null,
        custodyVehicleType: item.custody_vehicle_type || '',
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        createdBy: item.created_by || undefined,
        creatorName: item.creator?.full_name || item.creator?.email || undefined
      };
      
      console.log('✅ Service transformed:', {
        folio: transformedService.folio,
        createdBy: transformedService.createdBy,
        creatorName: transformedService.creatorName,
        hasCreatorData: !!item.creator,
        creatorFullName: item.creator?.full_name,
        creatorEmail: item.creator?.email
      });
      return transformedService;
    });
  }, []);

  return { transformRawServiceData };
};