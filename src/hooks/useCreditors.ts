import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Creditor {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  is_active: boolean;
  supplier_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreditorFormData {
  name: string;
  type: string;
  notes?: string;
  supplier_id?: string | null;
  category_id?: string | null;
  subcategory?: string | null;
}

export const useCreditors = () => {
  return useQuery({
    queryKey: ['creditors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creditors')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Creditor[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateCreditor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreditorFormData) => {
      const { data: result, error } = await supabase
        .from('creditors')
        .insert({
          name: data.name,
          type: data.type,
          notes: data.notes || null,
          supplier_id: data.supplier_id || null,
          metadata: {
            category_id: data.category_id || null,
            subcategory: data.subcategory || null,
          },
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creditors'] });
      toast.success('Acreedor creado');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
};

export const useUpdateCreditor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: CreditorFormData & { id: string }) => {
      const { error } = await supabase
        .from('creditors')
        .update({
          name: data.name,
          type: data.type,
          notes: data.notes || null,
          supplier_id: data.supplier_id || null,
          metadata: {
            category_id: data.category_id || null,
            subcategory: data.subcategory || null,
          },
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creditors'] });
      toast.success('Acreedor actualizado');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
};
