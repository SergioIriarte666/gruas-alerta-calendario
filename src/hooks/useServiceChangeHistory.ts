import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceChangeEntry {
  id: string;
  serviceId: string;
  serviceFolio: string;
  changedBy: string | null;
  changerName: string | null;
  changerEmail: string | null;
  changedAt: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeSummary: string | null;
  changeContext: string | null;
}

export interface GroupedChanges {
  date: string;
  changerName: string;
  changerEmail: string | null;
  changes: ServiceChangeEntry[];
}

export const useServiceChangeHistory = (serviceId: string | null) => {
  return useQuery({
    queryKey: ['service-change-history', serviceId],
    queryFn: async (): Promise<ServiceChangeEntry[]> => {
      if (!serviceId) return [];

      const { data, error } = await supabase
        .from('service_change_history')
        .select(`
          id,
          service_id,
          service_folio,
          changed_by,
          changed_at,
          change_type,
          field_name,
          old_value,
          new_value,
          change_summary,
          change_context,
          profiles:changed_by (
            id,
            full_name,
            email
          )
        `)
        .eq('service_id', serviceId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Error fetching service change history:', error);
        throw error;
      }

      return (data || []).map((entry: any) => ({
        id: entry.id,
        serviceId: entry.service_id,
        serviceFolio: entry.service_folio,
        changedBy: entry.changed_by,
        changerName: entry.profiles?.full_name || null,
        changerEmail: entry.profiles?.email || null,
        changedAt: entry.changed_at,
        changeType: entry.change_type as 'CREATE' | 'UPDATE' | 'DELETE',
        fieldName: entry.field_name,
        oldValue: entry.old_value,
        newValue: entry.new_value,
        changeSummary: entry.change_summary,
        changeContext: entry.change_context,
      }));
    },
    enabled: !!serviceId,
  });
};

// Función helper para agrupar cambios por fecha y usuario
export const groupChangesByDateAndUser = (changes: ServiceChangeEntry[]): GroupedChanges[] => {
  const groups: Map<string, GroupedChanges> = new Map();

  changes.forEach((change) => {
    const date = new Date(change.changedAt);
    const dateKey = date.toISOString().split('T')[0];
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
