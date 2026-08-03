import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import {
  buildItemsSnapshot,
  isUniqueViolation,
  resolvePerformedMoment,
} from '@/utils/checklists/checklistLogic';
import { businessClock } from '@/utils/businessClock';
import { generateChecklistPDF } from '@/utils/pdf/checklistPdfGenerator';
import { uploadChecklistPdf } from '@/utils/checklists/checklistPdfUpload';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import type {
  ChecklistPdfContext,
  ChecklistPdfSource,
} from '@/utils/pdf/checklistPdfPlan';
import type {
  Checklist,
  ChecklistAnswers,
  ChecklistHeader,
  ChecklistItemsSnapshot,
  ChecklistStatus,
  ChecklistTemplate,
} from '@/types/checklists';

const logger = createLogger('Checklists');

export interface CreateDraftInput {
  template: ChecklistTemplate;
  operatorId: string;
  craneId?: string | null;
  serviceId?: string | null;
  header?: ChecklistHeader;
}

/** Campos que el operador puede modificar mientras el checklist sigue abierto. */
export interface ChecklistDraftPatch {
  answers?: ChecklistAnswers;
  header?: ChecklistHeader;
  observations?: string | null;
  is_safe_to_operate?: boolean | null;
  operator_signature?: string | null;
  reviewer_name?: string | null;
  reviewer_signature?: string | null;
  crane_id?: string | null;
  service_id?: string | null;
}

/** Error de negocio ya traducido: la UI lo muestra tal cual, sin tocar Postgres. */
export class ChecklistConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChecklistConflictError';
  }
}

const DUPLICATE_PREOP_MESSAGE = 'Ya existe un pre-operacional firmado para esta grúa hoy';

const hydrateRow = (row: Record<string, unknown>): Checklist => ({
  ...(row as unknown as Checklist),
  status: row.status as ChecklistStatus,
  items_snapshot: (Array.isArray(row.items_snapshot) ? row.items_snapshot : []) as ChecklistItemsSnapshot,
  answers: (row.answers ?? {}) as ChecklistAnswers,
  header: (row.header ?? {}) as ChecklistHeader,
});

export const useChecklistManager = (operatorId?: string | null) => {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    // Prefijo, no llave exacta: alcanza al listado de este operador y a
    // cualquier otra vista que cuelgue de ['checklists', ...].
    queryClient.invalidateQueries({ queryKey: ['checklists'] });
  }, [queryClient]);

  /**
   * Arranca un checklist. El snapshot se congela ACÁ, con los ítems activos del
   * momento; el formulario ya no vuelve a mirar el maestro.
   */
  const createDraft = useMutation({
    mutationFn: async ({
      template,
      operatorId: opId,
      craneId = null,
      serviceId = null,
      header = {},
    }: CreateDraftInput): Promise<Checklist> => {
      const itemsSnapshot = buildItemsSnapshot(template);
      if (itemsSnapshot.length === 0) {
        throw new ChecklistConflictError('La plantilla no tiene ítems activos');
      }

      const { performed_at, performed_date } = resolvePerformedMoment();

      const { data, error } = await supabase
        .from('checklists')
        .insert({
          template_id: template.id,
          template_version: template.version,
          items_snapshot: itemsSnapshot as unknown as never,
          operator_id: opId,
          crane_id: craneId,
          service_id: serviceId,
          performed_at,
          performed_date,
          header: header as unknown as never,
          answers: {} as unknown as never,
          status: 'draft',
        })
        .select('*')
        .single();

      if (error) {
        logger.error('Error creando borrador de checklist:', error);
        throw error;
      }

      logger.debug('Borrador creado', {
        id: data.id,
        template: template.id,
        version: template.version,
        performed_date,
        items: itemsSnapshot.reduce((n, s) => n + s.items.length, 0),
      });

      return hydrateRow(data as unknown as Record<string, unknown>);
    },
    onSuccess: invalidate,
    onError: (error) => {
      if (error instanceof ChecklistConflictError) {
        toast.error(error.message);
        return;
      }
      toast.error('No se pudo iniciar el checklist');
    },
  });

  /**
   * Persiste el avance. Se llama en cada cambio de sección y al salir de la
   * pantalla: lo que está en la base sobrevive a que iOS mate el proceso.
   */
  const saveDraft = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: ChecklistDraftPatch;
      silent?: boolean;
    }): Promise<void> => {
      // El guard `status='draft'` hace que un autoguardado tardío (la pantalla se
      // desmonta justo después de firmar) no pueda pisar un documento ya cerrado.
      const { error } = await supabase
        .from('checklists')
        .update(patch as unknown as never)
        .eq('id', id)
        .eq('status', 'draft');

      if (error) {
        logger.error('Error guardando borrador de checklist:', error);
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      invalidate();
      if (!variables.silent) toast.success('Avance guardado');
    },
    onError: (_error, variables) => {
      if (!variables?.silent) toast.error('No se pudo guardar el avance');
    },
  });

  /**
   * Cierra el documento: 'draft' -> 'signed'.
   *
   * El pre-operacional puede chocar con ux_checklists_preop_crane_day (uno por
   * grúa por día, borradores excluidos). Ese 23505 se traduce; el operador nunca
   * ve el error crudo de Postgres.
   */
  const signChecklist = useMutation({
    mutationFn: async ({
      id,
      templateId,
      patch,
    }: {
      id: string;
      templateId: string;
      patch: ChecklistDraftPatch;
    }): Promise<Checklist> => {
      const { data, error } = await supabase
        .from('checklists')
        .update({ ...patch, status: 'signed' } as unknown as never)
        .eq('id', id)
        .eq('status', 'draft')
        .select('*')
        .single();

      if (error) {
        // PGRST116 = el UPDATE no tocó ninguna fila. Con el guard `status='draft'`
        // eso significa que el documento ya se había cerrado (doble toque, o la
        // misma cuenta en otro dispositivo), no que algo se rompiera.
        if ((error as { code?: string }).code === 'PGRST116') {
          throw new ChecklistConflictError('Este checklist ya está cerrado');
        }
        if (isUniqueViolation(error)) {
          logger.warn('Pre-operacional duplicado para la grúa del día', { id, templateId });
          throw new ChecklistConflictError(
            templateId === CHECKLIST_TEMPLATE_IDS.preoperacional
              ? DUPLICATE_PREOP_MESSAGE
              : 'Ya existe un checklist firmado equivalente',
          );
        }
        logger.error('Error firmando checklist:', error);
        throw error;
      }

      return hydrateRow(data as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Checklist firmado y cerrado');
    },
    onError: (error) => {
      if (error instanceof ChecklistConflictError) {
        toast.error(error.message);
        return;
      }
      toast.error('No se pudo firmar el checklist');
    },
  });

  /**
   * Genera el PDF, lo sube al bucket y guarda la referencia.
   *
   * OJO con el guard de status: el resto de las mutaciones filtra por
   * status='draft' para que un autoguardado tardío no pise un documento
   * cerrado. Acá NO se puede filtrar así — el PDF se escribe justamente sobre un
   * checklist ya 'signed' — por eso la condición es solo por id.
   *
   * Nunca lanza hacia arriba en el flujo de firma: si el PDF falla, el checklist
   * ya quedó firmado y eso es lo que no se puede perder. Se avisa y se reintenta
   * desde el botón "Regenerar PDF".
   */
  const generatePdf = useMutation({
    mutationFn: async ({
      checklist,
      context,
    }: {
      checklist: ChecklistPdfSource;
      context: ChecklistPdfContext;
      silent?: boolean;
    }): Promise<string> => {
      const blob = await generateChecklistPDF({ checklist, context });
      const { path } = await uploadChecklistPdf(
        blob,
        checklist.id,
        checklist.template_id,
        checklist.performed_date,
      );

      // Se persiste el PATH, no la URL firmada: las signed URL caducan a los 7
      // días y el documento tiene que seguir accesible años después.
      const { error } = await supabase
        .from('checklists')
        .update({ pdf_url: path, pdf_uploaded_at: businessClock.nowISO() })
        .eq('id', checklist.id);

      if (error) {
        logger.error('Error persistiendo la referencia al PDF:', error);
        throw error;
      }

      return path;
    },
    onSuccess: (_path, variables) => {
      invalidate();
      if (!variables.silent) toast.success('PDF generado');
    },
    onError: (error, variables) => {
      logger.error('No se pudo generar el PDF del checklist', error);
      if (variables?.silent) {
        // Firma exitosa, PDF fallido: el checklist NO se pierde.
        toast.warning('El checklist quedó firmado, pero el PDF no se generó', {
          description: 'Puede reintentarlo desde el detalle con "Regenerar PDF".',
        });
        return;
      }
      toast.error('No se pudo generar el PDF');
    },
  });

  return {
    operatorId,
    createDraft,
    saveDraft,
    signChecklist,
    generatePdf,
    isCreating: createDraft.isPending,
    isSaving: saveDraft.isPending,
    isSigning: signChecklist.isPending,
    isGeneratingPdf: generatePdf.isPending,
  };
};
