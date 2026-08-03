import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';
import type {
  ChecklistAnswerType,
  ChecklistAnswers,
  ChecklistHeader,
  ChecklistItemsSnapshot,
  ChecklistListItem,
  ChecklistStatus,
} from '@/types/checklists';

const logger = createLogger('Checklists');

/** Ventana del listado del operador. */
export const CHECKLIST_HISTORY_DAYS = 30;

/**
 * Primer día de la ventana, en día comercial. Se calcula desde businessClock
 * para que el corte no dependa de la zona horaria del dispositivo.
 */
export const getHistoryStartDate = (days = CHECKLIST_HISTORY_DAYS): string => {
  const today = businessClock.todayDate();
  today.setDate(today.getDate() - days);
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const CHECKLIST_SELECT = `
  id,
  template_id,
  template_version,
  items_snapshot,
  operator_id,
  crane_id,
  service_id,
  performed_at,
  performed_date,
  header,
  answers,
  observations,
  is_safe_to_operate,
  operator_signature,
  reviewer_name,
  reviewer_signature,
  status,
  pdf_url,
  pdf_uploaded_at,
  email_sent_at,
  deleted_at,
  created_at,
  updated_at,
  checklist_templates ( name, answer_type ),
  cranes ( license_plate, brand, model ),
  services ( folio )
`;

interface RawChecklist {
  [key: string]: unknown;
  checklist_templates: { name: string; answer_type: string } | null;
  cranes: { license_plate: string; brand: string | null; model: string | null } | null;
  services: { folio: string } | null;
}

/**
 * Normaliza la fila cruda: los jsonb llegan como `Json` y la UI necesita las
 * formas concretas. Un jsonb corrupto o vacío degrada a estructura vacía en vez
 * de romper el listado completo.
 */
export const hydrateChecklist = (row: RawChecklist): ChecklistListItem => {
  const crane = row.cranes;
  const craneLabel = crane
    ? [crane.license_plate, [crane.brand, crane.model].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(' · ')
    : null;

  return {
    ...(row as unknown as ChecklistListItem),
    status: row.status as ChecklistStatus,
    items_snapshot: Array.isArray(row.items_snapshot)
      ? (row.items_snapshot as ChecklistItemsSnapshot)
      : [],
    answers: (row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers)
      ? row.answers
      : {}) as ChecklistAnswers,
    header: (row.header && typeof row.header === 'object' && !Array.isArray(row.header)
      ? row.header
      : {}) as ChecklistHeader,
    template_name: row.checklist_templates?.name ?? 'Checklist',
    template_answer_type: (row.checklist_templates?.answer_type ?? 'si_no_na') as ChecklistAnswerType,
    crane_label: craneLabel,
    service_folio: row.services?.folio ?? null,
  };
};

export const fetchOperatorChecklists = async (operatorId: string): Promise<ChecklistListItem[]> => {
  const { data, error } = await supabase
    .from('checklists')
    .select(CHECKLIST_SELECT)
    .eq('operator_id', operatorId)
    .is('deleted_at', null)
    .gte('performed_date', getHistoryStartDate())
    .order('performed_at', { ascending: false });

  if (error) {
    logger.error('Error cargando checklists del operador:', error);
    throw error;
  }

  return ((data ?? []) as unknown as RawChecklist[]).map(hydrateChecklist);
};

export const useChecklistsFetcher = (operatorId?: string | null) => {
  const query = useQuery({
    queryKey: ['checklists', operatorId],
    queryFn: () => fetchOperatorChecklists(operatorId as string),
    enabled: Boolean(operatorId),
    staleTime: 60 * 1000,
  });

  return {
    checklists: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};
