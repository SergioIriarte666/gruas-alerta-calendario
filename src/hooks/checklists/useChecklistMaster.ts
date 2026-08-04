import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import type {
  ChecklistAnswerType,
  ChecklistRiskAnswer,
  ChecklistTemplate,
} from '@/types/checklists';

const logger = createLogger('ChecklistMaster');

/**
 * Plantillas de las que dependen el índice único parcial
 * ux_checklists_preop_crane_day y el branch de columnas del generador de PDF.
 * Sus ids son literales en el código: no se crean plantillas nuevas ni se
 * eliminan estas dos.
 *
 * La barrera real está en la base (trigger protect_checklist_templates); esta
 * lista es la que además hace que el manager falle antes de llegar allá, para
 * que el error se lea y no dependa de que la UI esconda un botón.
 */
export const PROTECTED_TEMPLATE_IDS: readonly string[] = [
  CHECKLIST_TEMPLATE_IDS.fatiga,
  CHECKLIST_TEMPLATE_IDS.preoperacional,
];

const MASTER_KEY = ['checklist-master'] as const;

/** Catálogo COMPLETO, con inactivos: es la pantalla de administración. */
const fetchMaster = async (): Promise<ChecklistTemplate[]> => {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select(`
      id, name, subtitle, version, answer_type, is_active,
      checklist_template_sections (
        id, title, sort_order, answer_type,
        checklist_template_items ( id, label, sort_order, is_active, risk_answer, answer_type )
      )
    `)
    .order('id');

  if (error) {
    logger.error('Error cargando el maestro de checklists:', error);
    throw error;
  }

  return (data ?? []).map((template) => ({
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
        answer_type: (section.answer_type as ChecklistAnswerType | null) ?? null,
        // A diferencia del catálogo que consume el formulario, acá NO se filtran
        // los inactivos: el admin tiene que poder volver a activarlos.
        items: [...(section.checklist_template_items ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => ({
            id: item.id,
            label: item.label,
            sort_order: item.sort_order,
            is_active: item.is_active,
            risk_answer: (item.risk_answer as ChecklistRiskAnswer) ?? null,
            answer_type: (item.answer_type as ChecklistAnswerType | null) ?? null,
          })),
      })),
  }));
};

export interface UpdateItemInput {
  id: string;
  label?: string;
  is_active?: boolean;
  /** null = heredar de la sección. */
  answer_type?: ChecklistAnswerType | null;
  /** null = sin respuesta de riesgo. Solo aplica al de fatiga. */
  risk_answer?: ChecklistRiskAnswer;
}

export const useChecklistMaster = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: MASTER_KEY,
    queryFn: fetchMaster,
    staleTime: 30 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: MASTER_KEY });
    // El catálogo que consume el formulario del operador también quedó viejo.
    queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
  };

  const run = <TVars>(
    fn: (vars: TVars) => Promise<void>,
    okMessage: string,
    failMessage: string,
  ) => useMutation({
    mutationFn: fn,
    onSuccess: () => { invalidate(); toast.success(okMessage); },
    onError: (error: unknown) => {
      logger.error(failMessage, error);
      const message = (error as { message?: string })?.message;
      toast.error(failMessage, { description: message });
    },
  });

  // ── Ítems ────────────────────────────────────────────────────────────────
  // El alta pasa por RPC porque el sort_order "al final" se calcula en la base:
  // si lo eligiera el cliente, dos altas seguidas chocarían con la llave única.
  const addItem = run<{ sectionId: string; label: string }>(
    async ({ sectionId, label }) => {
      const { error } = await supabase.rpc('admin_add_checklist_item', {
        p_section_id: sectionId,
        p_label: label,
      });
      if (error) throw error;
    },
    'Ítem agregado',
    'No se pudo agregar el ítem',
  );

  const updateItem = run<UpdateItemInput>(
    async ({ id, ...patch }) => {
      const { error } = await supabase
        .from('checklist_template_items')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    'Ítem actualizado',
    'No se pudo actualizar el ítem',
  );

  // Borrado REAL, sin baja lógica: cada checklist guarda su items_snapshot, así
  // que esto no toca documentos firmados ni borradores abiertos.
  const deleteItem = run<string>(
    async (id) => {
      const { error } = await supabase.from('checklist_template_items').delete().eq('id', id);
      if (error) throw error;
    },
    'Ítem eliminado',
    'No se pudo eliminar el ítem',
  );

  // El reorden va por RPC con la llave única diferida al COMMIT: reasignar
  // 1..N en updates sueltos choca contra UNIQUE (section_id, sort_order) en los
  // estados intermedios. Es la diferencia con la pantalla de Inventario, cuya
  // tabla no tiene esa restricción.
  const reorderItems = run<{ sectionId: string; itemIds: string[] }>(
    async ({ sectionId, itemIds }) => {
      const { error } = await supabase.rpc('admin_reorder_checklist_items', {
        p_section_id: sectionId,
        p_item_ids: itemIds,
      });
      if (error) throw error;
    },
    'Orden actualizado',
    'No se pudo reordenar',
  );

  // ── Secciones ────────────────────────────────────────────────────────────
  const addSection = run<{ templateId: string; title: string }>(
    async ({ templateId, title }) => {
      const { error } = await supabase.rpc('admin_add_checklist_section', {
        p_template_id: templateId,
        p_title: title,
      });
      if (error) throw error;
    },
    'Sección agregada',
    'No se pudo agregar la sección',
  );

  const updateSection = run<{ id: string; title?: string; answer_type?: ChecklistAnswerType | null }>(
    async ({ id, ...patch }) => {
      const { error } = await supabase
        .from('checklist_template_sections')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    'Sección actualizada',
    'No se pudo actualizar la sección',
  );

  const deleteSection = run<{ id: string; confirmItems: boolean }>(
    async ({ id, confirmItems }) => {
      const { error } = await supabase.rpc('admin_delete_checklist_section', {
        p_section_id: id,
        p_confirm_items: confirmItems,
      });
      if (error) throw error;
    },
    'Sección eliminada',
    'No se pudo eliminar la sección',
  );

  const reorderSections = run<{ templateId: string; sectionIds: string[] }>(
    async ({ templateId, sectionIds }) => {
      const { error } = await supabase.rpc('admin_reorder_checklist_sections', {
        p_template_id: templateId,
        p_section_ids: sectionIds,
      });
      if (error) throw error;
    },
    'Orden de secciones actualizado',
    'No se pudo reordenar las secciones',
  );

  // ── Plantillas: solo lo que está permitido ───────────────────────────────
  const updateTemplate = run<{ id: string; name?: string; subtitle?: string | null }>(
    async ({ id, ...patch }) => {
      const { error } = await supabase.from('checklist_templates').update(patch).eq('id', id);
      if (error) throw error;
    },
    'Plantilla actualizada',
    'No se pudo actualizar la plantilla',
  );

  /**
   * No existen `createTemplate` ni `deleteTemplate` a propósito. Si algún día se
   * agregan, estas guardas son las que tienen que seguir negando las dos
   * plantillas protegidas.
   */
  const assertTemplateDeletable = (templateId: string): void => {
    if (PROTECTED_TEMPLATE_IDS.includes(templateId)) {
      throw new Error(
        `La plantilla ${templateId} no se puede eliminar: de su id dependen el índice ` +
        'ux_checklists_preop_crane_day y el generador de PDF.',
      );
    }
  };

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addItem, updateItem, deleteItem, reorderItems,
    addSection, updateSection, deleteSection, reorderSections,
    updateTemplate, assertTemplateDeletable,
  };
};
