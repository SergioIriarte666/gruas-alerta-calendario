import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { createLogger } from '@/lib/logger';

const _logger = createLogger('useInventoryOrphans');

const INVENTORY_QUERY_KEYS = ['inventory-items', 'inventory-stock', 'inventory-movements'];

export interface OrphanItem {
  id: string;
  name: string;
  stock: number;
}

async function fetchActiveMovementCounts(itemIds: string[]): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};
  const { data } = await supabase
    .from('inventory_movements')
    .select('item_id')
    .in('item_id', itemIds)
    .eq('status', 'active');
  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: any) => {
    counts[row.item_id] = (counts[row.item_id] || 0) + 1;
  });
  return counts;
}

export const useInventoryOrphans = (
  getItemStock: (itemId: string) => number,
  activeItems: Array<{ id: string; name: string; is_active: boolean }>,
) => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const [isScanning, setIsScanning] = useState(false);
  const [orphans, setOrphans] = useState<OrphanItem[]>([]);

  const scan = async () => {
    try {
      setIsScanning(true);
      const candidates = activeItems.map((item) => ({
        id: item.id,
        name: item.name,
        stock: getItemStock(item.id),
      }));
      const zeroStock = candidates.filter((c) => c.stock === 0);
      const counts = await fetchActiveMovementCounts(zeroStock.map((c) => c.id));
      setOrphans(zeroStock.filter((c) => (counts[c.id] || 0) === 0));
    } catch {
      toast.error('No se pudo escanear ítems huérfanos');
    } finally {
      setIsScanning(false);
    }
  };

  const invalidate = () => {
    INVENTORY_QUERY_KEYS.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );
  };

  const deactivateMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from('inventory_items')
        .update({ is_active: false })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`Marcados inactivos: ${ids.length}`);
      setOrphans([]);
      invalidate();
    },
    onError: createMutationErrorHandler({
      title: 'Error al desactivar ítems',
      context: 'useInventoryOrphans - deactivate',
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('inventory_items').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`Eliminados: ${ids.length}`);
      setOrphans([]);
      invalidate();
    },
    onError: createMutationErrorHandler({
      title: 'Error al eliminar ítems',
      context: 'useInventoryOrphans - delete',
    }),
  });

  return {
    orphans,
    isScanning,
    scan,
    deactivateOrphans: (ids: string[]) => deactivateMutation.mutate(ids),
    deleteOrphans: (ids: string[]) => deleteMutation.mutate(ids),
    isCleaning: deactivateMutation.isPending || deleteMutation.isPending,
  };
};

export interface DeleteCandidateInfo {
  id: string;
  name: string;
  force: boolean;
}

export const useInventoryItemHardDelete = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const [preparingId, setPreparingId] = useState<string | null>(null);

  const invalidate = () => {
    INVENTORY_QUERY_KEYS.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );
  };

  const prepareDelete = async (
    itemId: string,
    itemName: string,
    getStock: (id: string) => number,
  ): Promise<DeleteCandidateInfo | null> => {
    try {
      setPreparingId(itemId);
      const stock = getStock(itemId);
      const { data: movements } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('item_id', itemId)
        .eq('status', 'active')
        .limit(1);
      const hasActive = (movements ?? []).length > 0;
      return { id: itemId, name: itemName, force: stock > 0 || hasActive };
    } catch {
      toast.error('No se pudo preparar la eliminación del registro');
      return null;
    } finally {
      setPreparingId(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }: { id: string; force: boolean }) => {
      if (force) {
        await supabase.from('inventory_movements').delete().eq('item_id', id);
        await supabase.from('inventory_stock').delete().eq('item_id', id);
        const { error } = await supabase.from('inventory_items').delete().eq('id', id);
        if (error) throw error;
      } else {
        await supabase.from('inventory_stock').delete().eq('item_id', id);
        const { error } = await supabase.from('inventory_items').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (_, { force }) => {
      toast.success(force ? 'Registro forzado eliminado' : 'Registro eliminado');
      invalidate();
    },
    onError: createMutationErrorHandler({
      title: 'Error eliminando registro',
      context: 'useInventoryItemHardDelete',
    }),
  });

  return {
    preparingId,
    prepareDelete,
    deleteItem: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
};
