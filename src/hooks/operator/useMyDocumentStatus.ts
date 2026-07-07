import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDaysUntilExpiry, getDocumentStatus } from '@/hooks/operators/useOperatorDocuments';
import type { DocumentStatus, DocumentType } from '@/types';

export interface MyDocumentStatusItem {
  documentType: DocumentType;
  expiryDate: string;
  daysUntil: number;
  docStatus: Exclude<DocumentStatus, 'sin_fecha'>;
}

export const useMyDocumentStatus = (operatorId?: string | null) => {
  return useQuery<MyDocumentStatusItem[]>({
    queryKey: ['my-document-status', operatorId],
    queryFn: async () => {
      if (!operatorId) return [];

      const { data, error } = await (supabase.from as any)('operator_documents')
        .select(`
          document_type,
          expiry_date,
          operator:operators!inner(operator_type)
        `)
        .eq('operator_id', operatorId)
        .eq('operator.operator_type', 'crane_operator')
        .not('expiry_date', 'is', null)
        .order('expiry_date', { ascending: true });

      if (error) throw error;

      return ((data ?? []) as Array<{ document_type: DocumentType; expiry_date: string | null }>)
        .flatMap((row) => {
          if (!row.expiry_date) return [];

          const docStatus = getDocumentStatus(row.expiry_date);
          if (docStatus === 'sin_fecha') return [];

          return [{
            documentType: row.document_type,
            expiryDate: row.expiry_date,
            daysUntil: getDaysUntilExpiry(row.expiry_date) ?? 0,
            docStatus,
          }];
        });
    },
    enabled: Boolean(operatorId),
    staleTime: 10 * 60 * 1000,
  });
};
