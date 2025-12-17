import { Database } from '@/integrations/supabase/types';

// Base type from Supabase
export type ServiceRate = Database['public']['Tables']['service_rates']['Row'];
export type ServiceRateInsert = Database['public']['Tables']['service_rates']['Insert'];
export type ServiceRateUpdate = Database['public']['Tables']['service_rates']['Update'];

// Extended type with relations
export interface ServiceRateWithRelations extends ServiceRate {
  client?: {
    id: string;
    name: string;
    department: string;
  };
  service_type?: {
    id: string;
    name: string;
  } | null;
  creator?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

// Form data type
export interface ServiceRateFormData {
  client_id: string;
  service_type_id?: string | null;
  origin: string;
  destination?: string | null;
  value: number;
  is_active: boolean;
  notes?: string | null;
}
