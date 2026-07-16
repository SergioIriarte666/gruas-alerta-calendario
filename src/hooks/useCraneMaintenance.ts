import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUniversalSync } from './useUniversalSync';
import { useErrorHandler } from '@/hooks/useErrorHandler';

import { getTodayLocal } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useCraneMaintenance");
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

// Helper: find or fetch the "Mantenimiento" category id
const getMaintenanceCategoryId = async (): Promise<string | null> => {
  const { data, error } = await supabase
    .from('cost_categories')
    .select('id')
    .ilike('name', '%mantenimiento%')
    .limit(1)
    .single();
  if (error || !data) {
    logger.error('Could not find Mantenimiento category:', error);
    return null;
  }
  return data.id;
};

// Helper: create or update cost linked to a maintenance record
const syncMaintenanceCost = async (params: {
  maintenanceId: string;
  craneId: string;
  amount: number;
  description: string;
  maintenanceType: string;
  completedDate?: string | null;
  scheduledDate?: string | null;
  provider?: string | null;
  markAsPaid?: boolean;
}) => {
  const categoryId = await getMaintenanceCategoryId();
  if (!categoryId) {
    logger.warn('Skipping cost sync: no Mantenimiento category found');
    return;
  }

  const costDate = params.completedDate || params.scheduledDate || getTodayLocal();
  const paymentDate = params.markAsPaid ? costDate : null;

  // Check if a cost already exists for this maintenance
  const { data: existingCost } = await supabase
    .from('costs')
    .select('id')
    .eq('maintenance_id', params.maintenanceId)
    .maybeSingle();

  if (existingCost) {
    const { error: updateErr } = await supabase
      .from('costs')
      .update({
        amount: params.amount,
        description: `Mantenimiento: ${params.description}`,
        date: costDate,
        subcategory: params.maintenanceType,
        payment_date: paymentDate,
      })
      .eq('id', existingCost.id);
    if (updateErr) {
      logger.error('Error updating maintenance cost:', updateErr);
      throw updateErr;
    }
  } else {
    // Get current user for created_by
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: insertErr } = await supabase
      .from('costs')
      .insert({
        maintenance_id: params.maintenanceId,
        crane_id: params.craneId,
        category_id: categoryId,
        amount: params.amount,
        description: `Mantenimiento: ${params.description}`,
        date: costDate,
        subcategory: params.maintenanceType,
        created_by: user?.id || null,
        payment_date: paymentDate,
        entity: 'gruas_5_norte',
        paid_by: 'gruas_5_norte',
      });
    if (insertErr) {
      logger.error('Error creating maintenance cost:', insertErr);
      throw insertErr;
    }
  }
};

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
        logger.error('Error fetching maintenance records:', error);
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
    mutationFn: async (maintenance: Omit<MaintenanceRecord, 'id' | 'createdAt'> & { kilometraje?: number; markAsPaid?: boolean }) => {
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

      // Auto-create cost if completed with cost > 0
      if (maintenance.status === 'completed' && maintenance.cost > 0) {
        try {
          await syncMaintenanceCost({
            maintenanceId: data.id,
            craneId: maintenance.craneId,
            amount: maintenance.cost,
            description: maintenance.description,
            maintenanceType: maintenance.maintenanceType,
            completedDate: maintenance.completedDate,
            scheduledDate: maintenance.scheduledDate,
            provider: maintenance.provider,
            markAsPaid: maintenance.markAsPaid,
          });
        } catch (e: any) {
          logger.error('Error syncing maintenance cost:', e);
          toast.error('Mantenimiento creado, pero hubo un error al registrar el costo: ' + (e?.message || 'Error desconocido'));
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crane-maintenance', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-costs', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-cost-status'] });
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
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MaintenanceRecord> & { kilometraje?: number; markAsPaid?: boolean } }) => {
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

      // Sync cost based on status
      const finalStatus = updates.status || data.status;
      const finalCost = updates.cost ?? data.cost;

      if (finalStatus === 'completed' && finalCost > 0) {
        try {
          await syncMaintenanceCost({
            maintenanceId: id,
            craneId: data.crane_id,
            amount: finalCost,
            description: updates.description || data.description,
            maintenanceType: updates.maintenanceType || data.maintenance_type,
            completedDate: updates.completedDate || data.completed_date,
            scheduledDate: updates.scheduledDate || data.scheduled_date,
            provider: updates.provider || data.provider,
            markAsPaid: updates.markAsPaid,
          });
        } catch (e: any) {
          logger.error('Error syncing maintenance cost:', e);
          toast.error('Mantenimiento actualizado, pero hubo un error al sincronizar el costo: ' + (e?.message || 'Error desconocido'));
        }
      } else if (finalStatus !== 'completed') {
        // If no longer completed, remove associated cost
        try {
          await supabase
            .from('costs')
            .delete()
            .eq('maintenance_id', id);
        } catch (e) {
          logger.error('Error removing maintenance cost:', e);
        }
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crane-maintenance', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-costs', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-cost-status'] });
      invalidateAll();
      
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

export const useDeleteMaintenance = () => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useUniversalSync();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete associated cost first
      await supabase
        .from('costs')
        .delete()
        .eq('maintenance_id', id);

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
      queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-cost-status'] });
      invalidateAll();
      toast.success('Registro de mantenimiento eliminado exitosamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Eliminar Mantenimiento',
      context: 'useCraneMaintenance - deleteMaintenance'
    }),
  });
};
