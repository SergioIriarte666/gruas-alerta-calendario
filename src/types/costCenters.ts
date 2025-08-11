import { Database } from "@/integrations/supabase/types";

export type CostCenter = Database['public']['Tables']['cost_centers']['Row'] & {
  parent?: CostCenter | null;
  children?: CostCenter[];
};

export type CostCenterFormData = Omit<Database['public']['Tables']['cost_centers']['Insert'], 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export type CostCenterWithStats = CostCenter & {
  total_costs: number;
  cost_count: number;
  budget_used_percentage: number;
};

export const BUDGET_PERIODS = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly', label: 'Anual' }
] as const;

export type BudgetPeriod = typeof BUDGET_PERIODS[number]['value'];