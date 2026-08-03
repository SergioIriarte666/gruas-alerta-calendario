import { z } from 'zod';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import {
  answerTypeForSnapshotItem,
  countSnapshotItems,
  isAnswerValidFor,
} from '@/utils/checklists/checklistLogic';
import type { ChecklistAnswerType, ChecklistItemsSnapshot } from '@/types/checklists';

/**
 * Esquema del formulario de checklist.
 *
 * Se construye a partir del items_snapshot del documento (no del maestro), igual
 * que buildInspectionFormSchema se construye por fase: la validación tiene que
 * seguir exactamente a lo que el operador ve en pantalla.
 *
 * Solo se aplica al FIRMAR. El borrador se guarda siempre, completo o no.
 */
export const buildChecklistFormSchema = (
  snapshot: ChecklistItemsSnapshot,
  answerType: ChecklistAnswerType,
  templateId: string,
) => {
  const totalItems = countSnapshotItems(snapshot);
  const isPreoperacional = templateId === CHECKLIST_TEMPLATE_IDS.preoperacional;

  return z.object({
    // Cada ítem se valida contra SU tipo de respuesta congelado, no contra uno
    // único de plantilla: la sección documental del pre-operacional admite
    // vigente/no_vigente y las de estado físico bueno/malo.
    answers: z
      .record(z.string(), z.string())
      .superRefine((answers, ctx) => {
        let missing = 0;
        for (const section of snapshot) {
          for (const item of section.items) {
            const answer = answers[item.id];
            if (!answer) {
              missing += 1;
              continue;
            }
            const itemType = answerTypeForSnapshotItem(item, section, answerType);
            if (!isAnswerValidFor(itemType, answer)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Respuesta inválida en "${item.label}"`,
              });
            }
          }
        }
        if (missing > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Responda los ${totalItems} ítems antes de firmar`,
          });
        }
      }),
    header: z.object({
      area_empresa: z.string().optional(),
      faena: z.string().optional(),
      tipo_vehiculo: z.string().optional(),
      patente: z.string().optional(),
      kilometraje_horas: z.string().optional(),
      lugar_operacion: z.string().optional(),
      hora: z.string().optional(),
    }),
    observations: z.string().optional(),
    // Solo el pre-operacional cierra con la pregunta de condiciones seguras.
    is_safe_to_operate: isPreoperacional
      ? z.boolean({ required_error: 'Indique si el camión está en condiciones seguras' })
      : z.boolean().nullable().optional(),
    operator_signature: z.string().min(1, 'La firma del operador es obligatoria'),
    // El revisor es opcional; si firma, se le pide el nombre para que la firma
    // tenga a quién atribuirse.
    reviewer_name: z.string().optional(),
    reviewer_signature: z.string().optional(),
    crane_id: z.string().nullable().optional(),
    service_id: z.string().nullable().optional(),
  }).refine(
    (values) => !values.reviewer_signature || Boolean(values.reviewer_name?.trim()),
    { path: ['reviewer_name'], message: 'Indique el nombre de quien revisa' },
  );
};

export type ChecklistFormValues = {
  answers: Record<string, string>;
  header: {
    area_empresa?: string;
    faena?: string;
    tipo_vehiculo?: string;
    patente?: string;
    kilometraje_horas?: string;
    lugar_operacion?: string;
    hora?: string;
  };
  observations?: string;
  is_safe_to_operate?: boolean | null;
  operator_signature: string;
  reviewer_name?: string;
  reviewer_signature?: string;
  crane_id?: string | null;
  service_id?: string | null;
};
