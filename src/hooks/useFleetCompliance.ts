import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FleetCompliance');

export type FleetComplianceLevel = 'ok' | 'warning' | 'error';
export type FleetComplianceResourceType = 'crane' | 'operator';

export interface FleetComplianceRow {
  resource_type: FleetComplianceResourceType;
  resource_id: string;
  resource_name: string;
  worst_level: FleetComplianceLevel;
  issues_count: number;
  next_item_label: string | null;
  next_expiry_date: string | null;
}

export const useFleetCompliance = () => {
  const query = useQuery<FleetComplianceRow[]>({
    queryKey: ['fleet-compliance'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_fleet_compliance');

      if (error) {
        logger.error('Error al cargar aptitud de flota:', error);
        throw error;
      }

      return (data ?? []) as FleetComplianceRow[];
    },
  });

  const byResourceId = useMemo(() => {
    const map = new Map<string, FleetComplianceRow>();

    for (const row of query.data ?? []) {
      map.set(row.resource_id, row);
    }

    return map;
  }, [query.data]);

  const counters = useMemo(() => {
    const errorRows = (query.data ?? []).filter((row) => row.worst_level === 'error');

    return {
      cranesNotFit: errorRows.filter((row) => row.resource_type === 'crane').length,
      operatorsNotFit: errorRows.filter((row) => row.resource_type === 'operator').length,
      totalNotFit: errorRows.length,
    };
  }, [query.data]);

  return {
    ...query,
    rows: query.data ?? [],
    byResourceId,
    counters,
  };
};
