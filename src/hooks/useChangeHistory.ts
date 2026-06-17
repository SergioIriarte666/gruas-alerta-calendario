import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toLocalDateString } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useChangeHistory");

export interface ChangeHistoryEntry {
  id: string;
  entityId: string;
  changedBy: string | null;
  changerName: string | null;
  changerEmail: string | null;
  changedAt: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'SNAPSHOT';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeSummary: string | null;
}

export interface GroupedChanges {
  date: string;
  changerName: string;
  changerEmail: string | null;
  changes: ChangeHistoryEntry[];
}

const mapRow = (e: any, idColumn: string): ChangeHistoryEntry => ({
  id: e.id,
  entityId: e[idColumn],
  changedBy: e.changed_by,
  changerName: e.profiles?.full_name || null,
  changerEmail: e.profiles?.email || null,
  changedAt: e.changed_at,
  changeType: e.change_type,
  fieldName: e.field_name,
  oldValue: e.old_value,
  newValue: e.new_value,
  changeSummary: e.change_summary,
});

export const useCostChangeHistory = (costId: string | null) =>
  useQuery({
    queryKey: ['cost-change-history', costId],
    queryFn: async (): Promise<ChangeHistoryEntry[]> => {
      if (!costId) return [];
      const { data, error } = await supabase
        .from('cost_change_history')
        .select('id, cost_id, changed_by, changed_at, change_type, field_name, old_value, new_value, change_summary, profiles:changed_by (id, full_name, email)')
        .eq('cost_id', costId)
        .order('changed_at', { ascending: false });
      if (error) {
        logger.error('[useChangeHistory] Error cargando historial de cambios de costo:', error);
        throw error;
      }
      return (data || []).map((r: any) => mapRow(r, 'cost_id'));
    },
    enabled: !!costId,
  });

export const useInventoryMovementChangeHistory = (movementId: string | null) =>
  useQuery({
    queryKey: ['inventory-movement-change-history', movementId],
    queryFn: async (): Promise<ChangeHistoryEntry[]> => {
      if (!movementId) return [];
      const { data, error } = await supabase
        .from('inventory_movement_change_history')
        .select('id, movement_id, changed_by, changed_at, change_type, field_name, old_value, new_value, change_summary, profiles:changed_by (id, full_name, email)')
        .eq('movement_id', movementId)
        .order('changed_at', { ascending: false });
      if (error) {
        logger.error('[useChangeHistory] Error cargando historial de cambios de movimiento:', error);
        throw error;
      }
      return (data || []).map((r: any) => mapRow(r, 'movement_id'));
    },
    enabled: !!movementId,
  });

export const useCranePartChangeHistory = (cranePartId: string | null) =>
  useQuery({
    queryKey: ['crane-part-change-history', cranePartId],
    queryFn: async (): Promise<ChangeHistoryEntry[]> => {
      if (!cranePartId) return [];
      const { data, error } = await supabase
        .from('crane_part_change_history')
        .select('id, crane_part_id, changed_by, changed_at, change_type, field_name, old_value, new_value, change_summary, profiles:changed_by (id, full_name, email)')
        .eq('crane_part_id', cranePartId)
        .order('changed_at', { ascending: false });
      if (error) {
        logger.error('[useChangeHistory] Error cargando historial de cambios de pieza:', error);
        throw error;
      }
      return (data || []).map((r: any) => mapRow(r, 'crane_part_id'));
    },
    enabled: !!cranePartId,
  });

export const groupChangesByDateAndUser = (changes: ChangeHistoryEntry[]): GroupedChanges[] => {
  const groups = new Map<string, GroupedChanges>();
  changes.forEach((change) => {
    const date = new Date(change.changedAt);
    const dateKey = toLocalDateString(date);
    const timeKey = date.toTimeString().slice(0, 5);
    const groupKey = `${dateKey}-${timeKey}-${change.changedBy || 'system'}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        date: change.changedAt,
        changerName: change.changerName || 'Sistema',
        changerEmail: change.changerEmail,
        changes: [],
      });
    }
    groups.get(groupKey)!.changes.push(change);
  });
  return Array.from(groups.values());
};
