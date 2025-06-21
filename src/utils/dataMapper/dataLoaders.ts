
import { supabase } from '@/integrations/supabase/client';
import { Client, Crane, Operator } from '@/types';
import { ServiceType } from '@/hooks/useServiceTypes';

export class DataLoaders {
  async loadClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return (data || []).map(client => ({
      id: client.id,
      name: client.name,
      rut: client.rut,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      isActive: client.is_active,
      createdAt: client.created_at,
      updatedAt: client.updated_at
    }));
  }

  async loadCranes(): Promise<Crane[]> {
    const { data, error } = await supabase
      .from('cranes')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return (data || []).map(crane => ({
      id: crane.id,
      licensePlate: crane.license_plate,
      brand: crane.brand,
      model: crane.model,
      type: crane.type,
      circulationPermitExpiry: crane.circulation_permit_expiry,
      insuranceExpiry: crane.insurance_expiry,
      technicalReviewExpiry: crane.technical_review_expiry,
      isActive: crane.is_active,
      createdAt: crane.created_at,
      updatedAt: crane.updated_at
    }));
  }

  async loadOperators(): Promise<Operator[]> {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return (data || []).map(operator => ({
      id: operator.id,
      name: operator.name,
      rut: operator.rut,
      phone: operator.phone || '',
      licenseNumber: operator.license_number,
      examExpiry: operator.exam_expiry,
      isActive: operator.is_active,
      createdAt: operator.created_at,
      updatedAt: operator.updated_at
    }));
  }

  async loadServiceTypes(): Promise<ServiceType[]> {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return (data || []).map(serviceType => ({
      id: serviceType.id,
      name: serviceType.name,
      description: serviceType.description || '',
      basePrice: serviceType.base_price,
      isActive: serviceType.is_active,
      vehicleInfoOptional: serviceType.vehicle_info_optional || false,
      purchaseOrderRequired: serviceType.purchase_order_required || false,
      originRequired: serviceType.origin_required !== false,
      destinationRequired: serviceType.destination_required !== false,
      craneRequired: serviceType.crane_required !== false,
      operatorRequired: serviceType.operator_required !== false,
      vehicleBrandRequired: serviceType.vehicle_brand_required !== false,
      vehicleModelRequired: serviceType.vehicle_model_required !== false,
      licensePlateRequired: serviceType.license_plate_required !== false,
      createdAt: serviceType.created_at,
      updatedAt: serviceType.updated_at
    }));
  }
}
