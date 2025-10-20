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
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface IncomeWithDetails extends Income {
  category?: IncomeCategory;
  client?: { id: string; name: string; };
}

export interface IncomeCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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
