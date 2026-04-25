import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toLocalDateString } from '@/utils/timezoneUtils';

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

const buildHook = (
  table: 'cost_change_history' | 'inventory_movement_change_history' | 'crane_part_change_history',
  idColumn: 'cost_id' | 'movement_id' | 'crane_part_id',
  queryKey: string,
) => (entityId: string | null) => {
  return useQuery({
    queryKey: [queryKey, entityId],
    queryFn: async (): Promise<ChangeHistoryEntry[]> => {
      if (!entityId) return [];
      const { data, error } = await supabase
        .from(table)
        .select(`id, ${idColumn}, changed_by, changed_at, change_type, field_name, old_value, new_value, change_summary, profiles:changed_by (id, full_name, email)`)
        .eq(idColumn, entityId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((e: any) => ({
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
      }));
    },
    enabled: !!entityId,
  });
};

export const useCostChangeHistory = buildHook('cost_change_history', 'cost_id', 'cost-change-history');
export const useInventoryMovementChangeHistory = buildHook('inventory_movement_change_history', 'movement_id', 'inventory-movement-change-history');
export const useCranePartChangeHistory = buildHook('crane_part_change_history', 'crane_part_id', 'crane-part-change-history');

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
