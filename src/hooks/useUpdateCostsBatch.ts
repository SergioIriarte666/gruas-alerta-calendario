import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CostBatchUpdateData {
  fields: {
    category_id?: string;
    subcategory?: string;
    date?: string;
    payment_date?: string | null;
    cost_center_id?: string | null;
    supplier_id?: string | null;
    notes?: string;
  };
  costIds: string[];
  appendNotes?: boolean;
}

export const useUpdateCostsBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CostBatchUpdateData) => {
      const updates = data.costIds.map(async (costId) => {
        const updateData: any = {};

        // Solo incluir campos que fueron habilitados
        if (data.fields.category_id) updateData.category_id = data.fields.category_id;
        if (data.fields.subcategory !== undefined) updateData.subcategory = data.fields.subcategory;
        if (data.fields.date) updateData.date = data.fields.date;
        if (data.fields.payment_date !== undefined) updateData.payment_date = data.fields.payment_date;
        if (data.fields.cost_center_id !== undefined) updateData.cost_center_id = data.fields.cost_center_id;
        if (data.fields.supplier_id !== undefined) updateData.supplier_id = data.fields.supplier_id;

        // Manejo especial para notas
        if (data.fields.notes) {
          if (data.appendNotes) {
            // Obtener nota actual y añadir
            const { data: currentCost } = await supabase
              .from('costs')
              .select('notes')
              .eq('id', costId)
              .single();

            updateData.notes = currentCost?.notes
              ? `${currentCost.notes}\n${data.fields.notes}`
              : data.fields.notes;
          } else {
            updateData.notes = data.fields.notes;
          }
        }

        return supabase
          .from('costs')
          .update(updateData)
          .eq('id', costId);
      });

      const results = await Promise.all(updates);

      // Verificar errores
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error('Errors during batch update:', errors);
        throw new Error(`${errors.length} costos no pudieron actualizarse`);
      }

      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
      toast.success(`${variables.costIds.length} costos actualizados correctamente`);
    },
    onError: (error: any) => {
      console.error('Error en actualización por lotes:', error);
      toast.error(error.message || 'Error al actualizar los costos');
    },
  });
};
