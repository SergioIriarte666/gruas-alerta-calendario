// Sistema de comisiones basado en datos reales de la tabla costs

export interface Commission {
  id: string;
  date: string;
  description: string;
  amount: number;
  operator_id: string;
  service_id?: string;
  service_folio?: string;
  subcategory: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'paid';
  // Relations
  services?: {
    id: string;
    folio: string;
    service_date: string;
    value: number;
    clients: {
      name: string;
    };
  };
  operators?: {
    id: string;
    name: string;
    rut: string;
  };
  // Computed fields
  commission_percentage?: number;
  service_value?: number;
  client_name?: string;
}

export interface CommissionBatch {
  id: string;
  batch_number: string;
  operator_id: string;
  total_amount: number;
  commission_count: number;
  period_from: string;
  period_to: string;
  status: 'draft' | 'paid' | 'cancelled';
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Relations
  operators?: {
    id: string;
    name: string;
    rut: string;
  };
  commission_ids: string[];
}

// Form interfaces
export interface CommissionBatchFormData {
  operator_id: string;
  period_from: Date;
  period_to: Date;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  commission_ids: string[];
}

// Filter types
export interface CommissionFilters {
  status: 'all' | 'pending' | 'paid';
  operator_id?: string;
  client_name?: string;
  date_from?: Date;
  date_to?: Date;
  amount_from?: number;
  amount_to?: number;
}

// Constants
export const COMMISSION_STATUS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'paid', label: 'Pagadas' },
] as const;

export const BATCH_STATUS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'paid', label: 'Pagado' },
  { value: 'cancelled', label: 'Cancelado' },
] as const;

export const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'Cheque',
  'Tarjeta',
] as const;

export type CommissionStatus = typeof COMMISSION_STATUS[number]['value'];
export type BatchStatus = typeof BATCH_STATUS[number]['value'];
export type PaymentMethod = typeof PAYMENT_METHODS[number];