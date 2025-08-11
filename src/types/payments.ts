export type PaymentStatus = 'pending' | 'applied' | 'partial' | 'cancelled';
export type ApplicationMethod = 'fifo' | 'manual' | 'proportional';

export interface Payment {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  bank_reference?: string;
  payment_method: string;
  notes?: string;
  status: PaymentStatus;
  applied_amount: number;
  remaining_amount: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithDetails extends Payment {
  client?: { id: string; name: string; };
}

export interface PaymentApplication {
  id: string;
  payment_id: string;
  invoice_id: string;
  applied_amount: number;
  application_method: ApplicationMethod;
  notes?: string;
  created_at: string;
}

export interface ManualApplication {
  invoice_id: string;
  amount: number;
}