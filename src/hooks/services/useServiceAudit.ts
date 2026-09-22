import type { Json } from '@/integrations/supabase/types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { getBusinessTimestampBounds } from '@/utils/timezoneUtils';
import { isCalendarDate } from '@/utils/calendarDate';
import { auditObject, buildServiceAuditRows, type AuditClient, type AuditCost, type AuditProfile, type AuditService, type ServiceAuditHistory, type CostAuditHistory, type CostAuditSnapshot } from '@/lib/serviceAudit';

const PAGE_SIZE = 500;

/** Read every page before filtering/exporting; errors never become an empty report. */
export async function readAuditPages<T extends { id: string | number }>(
  read: (after: T['id'] | undefined) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let after: T['id'] | undefined;
  while (true) {
    const { data, error } = await read(after);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
    // Do not infer completion from the server's page size: deployments may
    // configure a smaller PostgREST row limit.
    const last = data[data.length - 1].id;
    if (last === after) throw new Error('No se pudo avanzar en el historial de auditoría.');
    after = last;
  }
}

export const validAuditRange = (from: string, to: string) => isCalendarDate(from) && isCalendarDate(to) && from <= to;

export function useServiceAudit(from: string, to: string) {
  const { user } = useUser();
  const bounds = validAuditRange(from, to) ? getBusinessTimestampBounds(from, to) : null;
  const until = bounds?.lte ? new Date(Date.parse(bounds.lte) + 1).toISOString() : '';
  return useQuery({
    queryKey: ['service-audit-report', user?.id, bounds?.gte, until],
    enabled: user?.role === 'admin' && !!bounds,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const [histories, costHistories, snapshots] = await Promise.all([
        readAuditPages<ServiceAuditHistory>(after => {
          let query = supabase.from('service_change_history').select('*')
            .gte('changed_at', bounds!.gte!).lt('changed_at', until).order('id').limit(PAGE_SIZE).abortSignal(signal);
          if (after !== undefined) query = query.gt('id', after);
          return query;
        }),
        readAuditPages<CostAuditHistory>(after => {
          let query = supabase.from('cost_change_history').select('*')
            .gte('changed_at', bounds!.gte!).lt('changed_at', until).order('id').limit(PAGE_SIZE).abortSignal(signal);
          if (after !== undefined) query = query.gt('id', after);
          return query;
        }),
        readAuditPages<CostAuditSnapshot>(after => {
          let query = supabase.from('recovery_audit_entries')
            .select('id, record_id, old_data, new_data, created_at, user_id, action_type')
            .eq('module', 'costs').gte('created_at', bounds!.gte!).lt('created_at', until)
            .order('id').limit(PAGE_SIZE).abortSignal(signal);
          if (after !== undefined) query = query.gt('id', after);
          return query;
        }),
      ]);
      const costIds = [...new Set(costHistories.map(h => h.cost_id))];
      const costs: AuditCost[] = [];
      for (let i = 0; i < costIds.length; i += 100) {
        const { data, error } = await supabase.from('costs').select('id, service_id, service_folio, description')
          .in('id', costIds.slice(i, i + 100)).abortSignal(signal);
        if (error) throw error;
        costs.push(...data);
      }
      // A deleted cost can have changes in this period but a deletion outside
      // it. Recover its reference link from the immutable deletion snapshot.
      const foundCostIds = new Set(costs.map(c => c.id));
      const missingIds = costIds.filter(id => !foundCostIds.has(id));
      for (let i = 0; i < missingIds.length; i += 100) {
        const deleted = await readAuditPages<{ id: number; old_data: Json | null }>(after => {
          let query = supabase.from('audit_log').select('id, old_data').eq('table_name', 'costs').eq('operation', 'DELETE')
            .in('old_data->>id', missingIds.slice(i, i + 100)).order('id').limit(PAGE_SIZE).abortSignal(signal);
          if (after !== undefined) query = query.gt('id', after);
          return query;
        });
        for (const entry of deleted) {
          const record = auditObject(entry.old_data);
          if (typeof record.id === 'string') costs.push({ id: record.id, service_id: typeof record.service_id === 'string' ? record.service_id : null, service_folio: typeof record.service_folio === 'string' ? record.service_folio : null, description: typeof record.description === 'string' ? record.description : '' });
        }
      }
      const serviceIds = new Set(histories.map(h => h.service_id).filter(Boolean));
      costs.forEach(c => { if (c.service_id) serviceIds.add(c.service_id); });
      snapshots.forEach(s => [s.old_data, s.new_data].forEach(value => {
        const id = auditObject(value).service_id;
        if (typeof id === 'string') serviceIds.add(id);
      }));
      costHistories.filter(h => h.field_name === 'service_id').forEach(h => {
        if (h.old_value) serviceIds.add(h.old_value);
        if (h.new_value) serviceIds.add(h.new_value);
      });
      const services: AuditService[] = [];
      const ids = [...serviceIds];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('services').select('id, folio, license_plate, client_id')
          .in('id', ids.slice(i, i + 100)).abortSignal(signal);
        if (error) throw error;
        services.push(...data);
      }
      const clientIds = [...new Set([
        ...services.map(service => service.client_id),
        ...histories.filter(h => h.field_name === 'client_id').flatMap(h => [h.old_value, h.new_value]),
      ].filter(Boolean))];
      const clients: AuditClient[] = [];
      for (let i = 0; i < clientIds.length; i += 100) {
        const { data, error } = await supabase.from('clients').select('id, name, rut, department')
          .in('id', clientIds.slice(i, i + 100)).abortSignal(signal);
        if (error) throw error;
        clients.push(...data);
      }
      const userIds = [...new Set([...histories.map(h => h.changed_by), ...costHistories.map(h => h.changed_by), ...snapshots.map(s => s.user_id)].filter(Boolean))];
      const profiles: AuditProfile[] = [];
      for (let i = 0; i < userIds.length; i += 100) {
        const { data, error } = await supabase.from('profiles').select('id, full_name, email')
          .in('id', userIds.slice(i, i + 100)).abortSignal(signal);
        if (error) throw error;
        profiles.push(...data);
      }
      return buildServiceAuditRows(histories, costHistories, snapshots, services, costs, profiles, clients);
    },
  });
}
