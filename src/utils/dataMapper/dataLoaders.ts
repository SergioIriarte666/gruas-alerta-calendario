
import { Client, Crane, Operator, ServiceType } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export class DataLoaders {
  async loadClients(): Promise<Client[]> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      
      return data?.map(client => ({
        id: client.id,
        name: client.name,
        rut: client.rut,
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        department: client.department || 'General',
        isActive: client.is_active ?? true,
        createdAt: client.created_at || '',
        updatedAt: client.updated_at || ''
      })) || [];
    } catch (error) {
      console.error('Error loading clients:', error);
      return [];
    }
  }

  async loadCranes(): Promise<Crane[]> {
    try {
      const { data, error } = await supabase
        .from('cranes')
        .select('*')
        .order('license_plate');

      if (error) throw error;
      
      return data?.map(crane => ({
        id: crane.id,
        licensePlate: crane.license_plate,
        brand: crane.brand,
        model: crane.model,
        type: crane.type,
        circulationPermitExpiry: crane.circulation_permit_expiry,
        insuranceExpiry: crane.insurance_expiry,
        technicalReviewExpiry: crane.technical_review_expiry,
        isActive: crane.is_active ?? true,
        createdAt: crane.created_at || '',
        updatedAt: crane.updated_at || ''
      })) || [];
    } catch (error) {
      console.error('Error loading cranes:', error);
      return [];
    }
  }

  async loadOperators(): Promise<Operator[]> {
    try {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .order('name');

      if (error) throw error;
      
      return data?.map(operator => ({
        id: operator.id,
        name: operator.name,
        rut: operator.rut,
        phone: operator.phone || '',
        email: '', // Email not in operators table
        licenseNumber: operator.license_number,
        examExpiry: operator.exam_expiry,
        isActive: operator.is_active ?? true,
        createdAt: operator.created_at || '',
        updatedAt: operator.updated_at || ''
      })) || [];
    } catch (error) {
      console.error('Error loading operators:', error);
      return [];
    }
  }

  async loadServiceTypes(): Promise<ServiceType[]> {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .order('name');

      if (error) throw error;
      
      return data?.map(serviceType => ({
        id: serviceType.id,
        name: serviceType.name,
        description: serviceType.description || '',
        basePrice: serviceType.base_price || 0,
        isActive: serviceType.is_active ?? true,
        vehicleInfoOptional: serviceType.vehicle_info_optional ?? false,
        purchaseOrderRequired: serviceType.purchase_order_required ?? false,
        originRequired: serviceType.origin_required ?? true,
        destinationRequired: serviceType.destination_required ?? true,
        craneRequired: serviceType.crane_required ?? true,
        operatorRequired: serviceType.operator_required ?? true,
        vehicleBrandRequired: serviceType.vehicle_brand_required ?? true,
        vehicleModelRequired: serviceType.vehicle_model_required ?? true,
        licensePlateRequired: serviceType.license_plate_required ?? true,
        createdAt: serviceType.created_at || '',
        updatedAt: serviceType.updated_at || ''
      })) || [];
    } catch (error) {
      console.error('Error loading service types:', error);
      return [];
    }
  }
}
