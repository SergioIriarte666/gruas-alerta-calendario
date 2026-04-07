import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUniversalSync } from './useUniversalSync';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export interface MaintenanceRecord {
  id: string;
  craneId: string;
  maintenanceType: 'preventive' | 'corrective' | 'emergency';
  description: string;
  cost: number;
  provider?: string;
  scheduledDate?: string;
  completedDate?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  nextMaintenanceDate?: string;
  notes?: string;
  kilometraje?: number;
  performedBy?: string;
  createdAt: string;
  createdBy?: string;
  creatorName?: string;
}

const CRANE_MAINTENANCE_SELECT = `
  id,
  crane_id,
  maintenance_type,
  description,
  cost,
  provider,
  scheduled_date,
  completed_date,
  status,
  next_maintenance_date,
  notes,
  kilometraje,
  performed_by,
  receipt_photo_paths,
  created_at,
  created_by,
  updated_at,
  creator:profiles!crane_maintenance_created_by_fkey(id, full_name, email)
`;

export const useCraneMaintenance = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-maintenance', craneId],
    queryFn: async (): Promise<MaintenanceRecord[]> => {
      const { data, error } = await supabase
        .from('crane_maintenance')
        .select(CRANE_MAINTENANCE_SELECT)
        .eq('crane_id', craneId)
        .order('scheduled_date', { ascending: false });

      if (error) {
        console.error('Error fetching maintenance records:', error);
        throw error;
      }

      return (data || []).map((record: any) => ({
        id: record.id,
        craneId: record.crane_id,
        maintenanceType: record.maintenance_type as MaintenanceRecord['maintenanceType'],
        description: record.description,
        cost: record.cost,
        provider: record.provider,
        scheduledDate: record.scheduled_date,
        completedDate: record.completed_date,
        status: record.status as MaintenanceRecord['status'],
        nextMaintenanceDate: record.next_maintenance_date,
        notes: record.notes,
        kilometraje: record.kilometraje,
        performedBy: record.performed_by,
        createdAt: record.created_at,
        createdBy: record.created_by,
        creatorName: record.creator?.full_name || record.creator?.email || null,
      }));
    },
    enabled: !!craneId
  });
};

export const useCreateMaintenance = () => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useUniversalSync();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async (maintenance: Omit<MaintenanceRecord, 'id' | 'createdAt'> & { kilometraje?: number }) => {
      const { data, error } = await supabase
        .from('crane_maintenance')
        .insert({
          crane_id: maintenance.craneId,
          maintenance_type: maintenance.maintenanceType,
          description: maintenance.description,
          cost: maintenance.cost,
          provider: maintenance.provider || null,
          scheduled_date: maintenance.scheduledDate || null,
          completed_date: maintenance.completedDate || null,
          status: maintenance.status,
          next_maintenance_date: maintenance.nextMaintenanceDate || null,
          notes: maintenance.notes || null,
          kilometraje: maintenance.kilometraje || null,
          performed_by: maintenance.performedBy || null,
        })
        .select(CRANE_MAINTENANCE_SELECT)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crane-maintenance', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics', data.crane_id] });
      invalidateAll();
      toast.success('Registro de mantenimiento creado exitosamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Crear Mantenimiento',
      context: 'useCraneMaintenance - createMaintenance'
    })
  });
};

export const useUpdateMaintenance = () => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useUniversalSync();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MaintenanceRecord> & { kilometraje?: number } }) => {
      const { data, error } = await supabase
        .from('crane_maintenance')
        .update({
          maintenance_type: updates.maintenanceType,
          description: updates.description,
          cost: updates.cost,
          provider: updates.provider,
          scheduled_date: updates.scheduledDate,
          completed_date: updates.completedDate,
          status: updates.status,
          next_maintenance_date: updates.nextMaintenanceDate,
          notes: updates.notes,
          kilometraje: updates.kilometraje ?? null,
          performed_by: updates.performedBy ?? null,
        })
        .eq('id', id)
        .select(CRANE_MAINTENANCE_SELECT)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crane-maintenance', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics', data.crane_id] });
      invalidateAll();
      
      // If maintenance was completed, show specific message about cost generation
      if (variables.updates.status === 'completed' && variables.updates.cost && variables.updates.cost > 0) {
        toast.success('Mantenimiento completado - Costo generado automáticamente');
      } else {
        toast.success('Registro de mantenimiento actualizado exitosamente');
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Actualizar Mantenimiento',
      context: 'useCraneMaintenance - updateMaintenance'
    })
  });
};

// Hook to delete a maintenance record
export const useDeleteMaintenance = () => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useUniversalSync();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crane_maintenance')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crane-maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
      invalidateAll();
      toast.success('Registro de mantenimiento eliminado exitosamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Eliminar Mantenimiento',
      context: 'useCraneMaintenance - deleteMaintenance'
    }),
  });
};
