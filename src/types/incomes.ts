export interface Income {
  id: string;
  income_date: string;
  amount: number;
  description: string;
  category_id?: string;
  subcategory?: string;
  payment_method: PaymentMethod;
  bank_reference?: string;
  client_id?: string;
  occasional_client_name?: string;
  invoice_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface IncomeWithDetails extends Income {
  category?: IncomeCategory;
  client?: { id: string; name: string; };
  invoice?: {
    id: string;
    folio: string;
    numero_fiscal?: string;
    total: number;
    remaining_amount?: number;
    status: string;
  };
}

import { Database } from "@/integrations/supabase/types";

// Income Categories - usar tipo generado por Supabase
export type IncomeCategory = Database['public']['Tables']['income_categories']['Row'];
export type IncomeSubcategory = Database['public']['Tables']['income_subcategories']['Row'];

export type PaymentMethod = 
  | 'transferencia' 
  | 'efectivo' 
  | 'cheque' 
  | 'deposito' 
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'otro';

export interface IncomeFormData {
  income_date: string;
  amount: number;
  description: string;
  category_id: string;
  subcategory?: string;
  payment_method: PaymentMethod;
  bank_reference?: string;
  client_id?: string;
  occasional_client_name?: string;
  invoice_id?: string;
  notes?: string;
}

export interface IncomeFilters {
  category: string;
  dateFrom: string | null;
  dateTo: string | null;
  clientId: string;
  paymentMethod: string;
  minAmount: string;
  maxAmount: string;
}
