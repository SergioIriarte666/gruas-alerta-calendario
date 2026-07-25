import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";
import {
  fetchInspectionEquipmentCatalog,
  type EquipmentItem,
} from '@/services/inspectionEquipmentCatalog';

const logger = createLogger("useInspectionEquipment");

export type { EquipmentItem };

export const useInspectionEquipment = () => {
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inspection-equipment-items'],
    queryFn: fetchInspectionEquipmentCatalog,
    staleTime: 5 * 60 * 1000,
  });

  const activeItems = items.filter(i => i.is_active);

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const maxOrder = Math.max(0, ...items.map(i => i.sort_order));
      const { error } = await supabase
        .from('inspection_equipment_items')
        .insert({ id: slug, name: name.trim(), is_active: true, sort_order: maxOrder + 1 });
      if (error) {
        logger.error('[useInspectionEquipment] Error insertando elemento de equipo:', error);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection-equipment-items'] });
      toast.success('Elemento agregado');
    },
    onError: () => toast.error('Error al agregar elemento'),
  });

  const updateItem = useMutation({
    mutationFn: async (item: Partial<EquipmentItem> & { id: string }) => {
      const { error } = await supabase
        .from('inspection_equipment_items')
        .update({ name: item.name, is_active: item.is_active, sort_order: item.sort_order })
        .eq('id', item.id);
      if (error) {
        logger.error('[useInspectionEquipment] Error actualizando elemento de equipo:', error);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection-equipment-items'] });
    },
    onError: () => toast.error('Error al actualizar elemento'),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inspection_equipment_items')
        .delete()
        .eq('id', id);
      if (error) {
        logger.error('[useInspectionEquipment] Error eliminando elemento de equipo:', error);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection-equipment-items'] });
      toast.success('Elemento eliminado');
    },
    onError: () => toast.error('Error al eliminar elemento'),
  });

  const reorderItems = useMutation({
    mutationFn: async (reordered: EquipmentItem[]) => {
      const updates = reordered.map((item, index) =>
        supabase.from('inspection_equipment_items')
          .update({ sort_order: index + 1 })
          .eq('id', item.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection-equipment-items'] }),
    onError: () => toast.error('Error al reordenar'),
  });

  return { items, activeItems, isLoading, addItem, updateItem, deleteItem, reorderItems };
};
