
import { useMemo } from 'react';
import { Service } from '@/types';

export const useServiceTransformer = () => {
  const transformRawServiceData = useMemo(() => (data: any[]): Service[] => {
    return data.map((item: any) => {
      
      // PostgREST embedded relations can arrive with different keys depending on the query
      // (e.g. `clients` vs `client` alias). Normalize to avoid UI showing "Cliente no disponible".
      const normalizeEmbedded = <T,>(value: T | T[] | null | undefined): T | null => {
        if (!value) return null;
        return Array.isArray(value) ? (value[0] ?? null) : value;
      };

      const embeddedClient = normalizeEmbedded(item.client ?? item.clients);
      const embeddedThirdPartyClient = normalizeEmbedded(item.third_party_client ?? item.third_party_clients);
      const embeddedCrane = normalizeEmbedded(item.cranes ?? item.crane);
      const embeddedOperator = normalizeEmbedded(item.operators ?? item.operator);

      const transformedService: Service = {
        id: item.id,
        folio: item.folio,
        requestDate: item.request_date,
        serviceDate: item.service_date,
        client: embeddedClient ? {
          id: embeddedClient.id,
          name: embeddedClient.name,
          rut: embeddedClient.rut || '',
          phone: embeddedClient.phone || '',
          email: embeddedClient.email || '',
          address: embeddedClient.address || '',
          department: embeddedClient.department || '',
          isActive: embeddedClient.is_active ?? true,
          createdAt: embeddedClient.created_at || new Date().toISOString(),
          updatedAt: embeddedClient.updated_at || new Date().toISOString()
        } : embeddedThirdPartyClient ? {
          id: embeddedThirdPartyClient.id,
          name: embeddedThirdPartyClient.name,
          rut: embeddedThirdPartyClient.rut || '',
          phone: embeddedThirdPartyClient.phone || '',
          email: embeddedThirdPartyClient.email || '',
          address: embeddedThirdPartyClient.address || '',
          department: embeddedThirdPartyClient.department || '',
          isActive: embeddedThirdPartyClient.is_active ?? true,
          createdAt: embeddedThirdPartyClient.created_at || new Date().toISOString(),
          updatedAt: embeddedThirdPartyClient.updated_at || new Date().toISOString()
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
        crane: embeddedCrane ? {
          id: embeddedCrane.id,
          licensePlate: embeddedCrane.license_plate,
          brand: embeddedCrane.brand,
          model: embeddedCrane.model,
          type: embeddedCrane.type,
          isActive: embeddedCrane.is_active,
          circulationPermitExpiry: embeddedCrane.circulation_permit_expiry,
          insuranceExpiry: embeddedCrane.insurance_expiry,
          technicalReviewExpiry: embeddedCrane.technical_review_expiry,
          createdAt: embeddedCrane.created_at,
          updatedAt: embeddedCrane.updated_at
        } : null,
        operator: embeddedOperator ? {
          id: embeddedOperator.id,
          name: embeddedOperator.name,
          rut: embeddedOperator.rut,
          phone: embeddedOperator.phone,
          operatorType: (embeddedOperator.operator_type as 'crane_operator' | 'administrative') || 'crane_operator',
          department: embeddedOperator.department,
          position: embeddedOperator.position,
          licenseNumber: embeddedOperator.license_number,
          isActive: embeddedOperator.is_active,
          examExpiry: embeddedOperator.exam_expiry,
          createdAt: embeddedOperator.created_at,
          updatedAt: embeddedOperator.updated_at
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
        // Outsourced/Third-party service fields
        outsourcedProviderId: item.outsourced_provider_id || undefined,
        outsourcedCost: item.outsourced_cost ?? undefined,
        outsourcedNotes: item.outsourced_notes || undefined,
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
      
      return transformedService;
    });
  }, []);

  return { transformRawServiceData };
};