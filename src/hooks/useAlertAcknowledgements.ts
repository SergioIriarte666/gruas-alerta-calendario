import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AlertAcknowledgements');

export interface AlertAcknowledgementLookup {
  alertKey: string;
  docExpiryDate?: string | null;
}

interface AlertAcknowledgementRow {
  alert_key: string;
  doc_expiry_date: string;
  acknowledged_at: string;
  acknowledged_by: string | null;
  notes: string | null;
}

interface CreateAlertAcknowledgementInput {
  alertKey: string;
  docExpiryDate: string;
  acknowledgedBy?: string | null;
  notes?: string | null;
}

const buildLookupKey = (alertKey: string, docExpiryDate: string) => `${alertKey}::${docExpiryDate}`;

export function useAlertAcknowledgements(items: AlertAcknowledgementLookup[]) {
  const normalizedItems = useMemo(
    () =>
      items
        .filter((item) => item.alertKey && item.docExpiryDate)
        .map((item) => ({
          alertKey: item.alertKey,
          docExpiryDate: item.docExpiryDate as string,
        }))
        .sort((left, right) =>
          `${left.alertKey}:${left.docExpiryDate}`.localeCompare(`${right.alertKey}:${right.docExpiryDate}`),
        ),
    [items],
  );

  const uniqueAlertKeys = useMemo(
    () => [...new Set(normalizedItems.map((item) => item.alertKey))],
    [normalizedItems],
  );

  const query = useQuery({
    queryKey: ['alert-acknowledgements', normalizedItems],
    enabled: uniqueAlertKeys.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('alert_acknowledgements')
        .select('alert_key, doc_expiry_date, acknowledged_at, acknowledged_by, notes')
        .in('alert_key', uniqueAlertKeys);

      if (error) {
        logger.error('Error loading alert acknowledgements:', error);
        throw error;
      }

      return (data ?? []) as AlertAcknowledgementRow[];
    },
  });

  const activeAcknowledgements = useMemo(() => {
    const map = new Map<string, AlertAcknowledgementRow>();
    for (const row of query.data ?? []) {
      map.set(buildLookupKey(row.alert_key, row.doc_expiry_date), row);
    }
    return map;
  }, [query.data]);

  const isAcknowledged = (alertKey: string, docExpiryDate?: string | null) => {
    if (!alertKey || !docExpiryDate) return false;
    return activeAcknowledgements.has(buildLookupKey(alertKey, docExpiryDate));
  };

  return {
    acknowledgements: activeAcknowledgements,
    isLoading: query.isLoading || query.isFetching,
    isAcknowledged,
  };
}

export function useCreateAlertAcknowledgement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      alertKey,
      docExpiryDate,
      acknowledgedBy,
      notes,
    }: CreateAlertAcknowledgementInput) => {
      const payload = {
        alert_key: alertKey,
        doc_expiry_date: docExpiryDate,
        acknowledged_by: acknowledgedBy ?? null,
        notes: notes?.trim() ? notes.trim() : null,
      };

      const { error } = await (supabase as any)
        .from('alert_acknowledgements')
        .insert(payload);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-acknowledgements'] });
    },
  });
}
