import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCostInvalidation } from './useCostInvalidation';

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
  createdAt: string;
}

export const useCraneMaintenance = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-maintenance', craneId],
    queryFn: async (): Promise<MaintenanceRecord[]> => {
      const { data, error } = await supabase
        .from('crane_maintenance')
        .select('*')
        .eq('crane_id', craneId)
        .order('scheduled_date', { ascending: false });

      if (error) {
        console.error('Error fetching maintenance records:', error);
        throw error;
      }

      return (data || []).map(record => ({
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
        createdAt: record.created_at
      }));
    },
    enabled: !!craneId
  });
};

export const useCreateMaintenance = () => {
  const queryClient = useQueryClient();
  const { invalidateAllCostQueries } = useCostInvalidation();

  return useMutation({
    mutationFn: async (maintenance: Omit<MaintenanceRecord, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('crane_maintenance')
        .insert({
          crane_id: maintenance.craneId,
          maintenance_type: maintenance.maintenanceType,
          description: maintenance.description,
          cost: maintenance.cost,
          provider: maintenance.provider,
          scheduled_date: maintenance.scheduledDate,
          completed_date: maintenance.completedDate,
          status: maintenance.status,
          next_maintenance_date: maintenance.nextMaintenanceDate,
          notes: maintenance.notes
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crane-maintenance', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics', data.crane_id] });
      invalidateAllCostQueries(); // Invalidar queries de costos cuando se crea mantenimiento
      toast.success('Registro de mantenimiento creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating maintenance record:', error);
      toast.error('Error al crear el registro de mantenimiento');
    }
  });
};

export const useUpdateMaintenance = () => {
  const queryClient = useQueryClient();
  const { invalidateAllCostQueries } = useCostInvalidation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MaintenanceRecord> }) => {
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
          notes: updates.notes
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crane-maintenance', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics', data.crane_id] });
      invalidateAllCostQueries(); // Invalidar queries de costos cuando se actualiza mantenimiento
      toast.success('Registro de mantenimiento actualizado exitosamente');
    },
    onError: (error) => {
      console.error('Error updating maintenance record:', error);
      toast.error('Error al actualizar el registro de mantenimiento');
    }
  });
};

// Hook to delete a maintenance record
export const useDeleteMaintenance = () => {
  const queryClient = useQueryClient();

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
      toast.success('Registro de mantenimiento eliminado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'No se pudo eliminar el registro de mantenimiento');
    },
  });
};