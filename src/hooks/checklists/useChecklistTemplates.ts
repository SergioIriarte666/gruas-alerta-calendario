import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type {
  ChecklistAnswerType,
  ChecklistRiskAnswer,
  ChecklistTemplate,
} from '@/types/checklists';

const logger = createLogger('Checklists');

interface RawTemplate {
  id: string;
  name: string;
  subtitle: string | null;
  version: number;
  answer_type: string;
  is_active: boolean;
  checklist_template_sections: Array<{
    id: string;
    title: string;
    sort_order: number;
    checklist_template_items: Array<{
      id: string;
      label: string;
      sort_order: number;
      is_active: boolean;
      risk_answer: string | null;
    }>;
  }> | null;
}

/**
 * Catálogo vivo de plantillas con sus secciones e ítems ACTIVOS.
 *
 * Solo se usa para ARRANCAR un checklist (construir el snapshot). Un documento
 * ya creado se renderiza desde su items_snapshot, nunca desde acá.
 */
export const fetchChecklistTemplates = async (): Promise<ChecklistTemplate[]> => {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select(`
      id,
      name,
      subtitle,
      version,
      answer_type,
      is_active,
      checklist_template_sections (
        id,
        title,
        sort_order,
        checklist_template_items (
          id,
          label,
          sort_order,
          is_active,
          risk_answer
        )
      )
    `)
    .eq('is_active', true)
    .order('id');

  if (error) {
    logger.error('Error cargando plantillas de checklist:', error);
    throw error;
  }

  return ((data ?? []) as RawTemplate[]).map((template) => ({
    id: template.id,
    name: template.name,
    subtitle: template.subtitle,
    version: template.version,
    answer_type: template.answer_type as ChecklistAnswerType,
    is_active: template.is_active,
    sections: [...(template.checklist_template_sections ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((section) => ({
        id: section.id,
        title: section.title,
        sort_order: section.sort_order,
        // El filtro de activos se aplica acá y no en PostgREST: es un catálogo de
        // 38 filas y así el contrato del hook no depende de que el embed anidado
        // acepte filtros. buildItemsSnapshot vuelve a filtrar, que es lo que
        // realmente garantiza que un ítem desactivado no entre a un documento.
        items: [...(section.checklist_template_items ?? [])]
          .filter((item) => item.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => ({
            id: item.id,
            label: item.label,
            sort_order: item.sort_order,
            is_active: item.is_active,
            risk_answer: (item.risk_answer as ChecklistRiskAnswer) ?? null,
          })),
      })),
  }));
};

export const useChecklistTemplates = () => {
  const query = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: fetchChecklistTemplates,
    staleTime: 5 * 60 * 1000,
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
