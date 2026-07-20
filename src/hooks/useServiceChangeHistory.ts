import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isMeaningfulServiceChange } from '@/lib/serviceChangeHistory';

import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceChangeHistory");
export interface ServiceChangeEntry {
  id: string;
  eventId: string;
  serviceId: string | null;
  serviceFolio: string;
  changedBy: string | null;
  changerName: string | null;
  changerEmail: string | null;
  changedAt: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'SNAPSHOT';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeSummary: string | null;
  changeContext: string | null;
}

export interface GroupedChanges {
  eventId: string;
  date: string;
  changerName: string;
  changerEmail: string | null;
  changes: ServiceChangeEntry[];
}

const fetchServiceChangeHistory = async (serviceId: string | null): Promise<ServiceChangeEntry[]> => {
  if (!serviceId) return [];

  const { data, error } = await supabase
    .from('service_change_history')
    .select(`
      id,
      event_id,
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
    logger.error('Error fetching service change history:', error);
    throw error;
  }

  return (data || [])
    .map((entry: any): ServiceChangeEntry => ({
      id: entry.id,
      eventId: entry.event_id,
      serviceId: entry.service_id,
      serviceFolio: entry.service_folio,
      changedBy: entry.changed_by,
      changerName: entry.profiles?.full_name || null,
      changerEmail: entry.profiles?.email || null,
      changedAt: entry.changed_at,
      changeType: entry.change_type as 'CREATE' | 'UPDATE' | 'DELETE' | 'SNAPSHOT',
      fieldName: entry.field_name,
      oldValue: entry.old_value,
      newValue: entry.new_value,
      changeSummary: entry.change_summary,
      changeContext: entry.change_context,
    }))
    .filter(isMeaningfulServiceChange);
};

// Agrupa por event_id: todas las filas insertadas por el mismo trigger dentro
// de la misma transacción (services + service_items) comparten event_id.
const groupChangesByEvent = (changes: ServiceChangeEntry[]): GroupedChanges[] => {
  const groups: Map<string, GroupedChanges> = new Map();

  changes.forEach((change) => {
    if (!groups.has(change.eventId)) {
      groups.set(change.eventId, {
        eventId: change.eventId,
        date: change.changedAt,
        changerName: change.changerName || 'Sistema',
        changerEmail: change.changerEmail,
        changes: [],
      });
    }
    groups.get(change.eventId)!.changes.push(change);
  });

  return Array.from(groups.values());
};

export const useServiceChangeHistory = (serviceId: string | null) => {
  return useQuery({
    queryKey: ['service-change-history', serviceId],
    queryFn: () => fetchServiceChangeHistory(serviceId),
    enabled: !!serviceId,
  });
};

// Misma queryKey que useServiceChangeHistory: comparte caché y fetch, solo
// difiere en la transformación aplicada vía `select` (agrupada por evento).
// Tanto la tabla como la vista móvil consumen esta misma estructura agrupada.
export const useGroupedServiceChangeHistory = (serviceId: string | null) => {
  return useQuery({
    queryKey: ['service-change-history', serviceId],
    queryFn: () => fetchServiceChangeHistory(serviceId),
    select: groupChangesByEvent,
    enabled: !!serviceId,
  });
};
