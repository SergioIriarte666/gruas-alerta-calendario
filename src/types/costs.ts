
import { Database } from "@/integrations/supabase/types";

export type CostCategory = Database['public']['Tables']['cost_categories']['Row'];

export type Cost = Database['public']['Tables']['costs']['Row'] & {
  cost_categories: CostCategory;
  cranes: Database['public']['Tables']['cranes']['Row'] | null;
  operators: Database['public']['Tables']['operators']['Row'] | null;
  services: Database['public']['Tables']['services']['Row'] | null;
};

export type CostFormData = Omit<Database['public']['Tables']['costs']['Insert'], 'id' | 'created_at' | 'updated_at' | 'created_by'>;
