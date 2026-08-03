/**
 * Tipos del módulo de Checklists de seguridad (portal operador).
 *
 * Los checklists son INDEPENDIENTES del flujo de servicio: `service_id` es
 * nullable por diseño y nunca condiciona la creación, el llenado ni la firma.
 */

import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];

export type ChecklistTemplateRow = Tables['checklist_templates']['Row'];
export type ChecklistTemplateSectionRow = Tables['checklist_template_sections']['Row'];
export type ChecklistTemplateItemRow = Tables['checklist_template_items']['Row'];
export type ChecklistRow = Tables['checklists']['Row'];
export type ChecklistInsert = Tables['checklists']['Insert'];
export type ChecklistUpdate = Tables['checklists']['Update'];

/** Identificadores sembrados en la Fase 1. */
export const CHECKLIST_TEMPLATE_IDS = {
  fatiga: 'fatiga_somnolencia',
  preoperacional: 'preoperacional_grua_cama',
} as const;

export type ChecklistTemplateId =
  (typeof CHECKLIST_TEMPLATE_IDS)[keyof typeof CHECKLIST_TEMPLATE_IDS];

/** Tipo de respuesta de la plantilla. Determina las opciones que ve el operador. */
export type ChecklistAnswerType = 'si_no_na' | 'bueno_malo_na';

/** Universo cerrado de respuestas de ambas plantillas. */
export type ChecklistAnswer = 'si' | 'no' | 'na' | 'bueno' | 'malo';

export type ChecklistStatus = 'draft' | 'signed' | 'sent' | 'void';

/** Marca qué respuesta indica riesgo. Metadato puro en esta fase. */
export type ChecklistRiskAnswer = 'si' | 'no' | null;

// ── Snapshot ───────────────────────────────────────────────────────────────
// Copia congelada de la plantilla en el momento de crear el borrador. El
// formulario renderiza SIEMPRE desde acá y NUNCA desde la plantilla viva: si un
// admin edita el maestro mientras el operador llena, no se le mueven los ítems.

export interface ChecklistSnapshotItem {
  id: string;
  label: string;
  sort_order: number;
  risk_answer: ChecklistRiskAnswer;
}

export interface ChecklistSnapshotSection {
  id: string;
  title: string;
  sort_order: number;
  items: ChecklistSnapshotItem[];
}

export type ChecklistItemsSnapshot = ChecklistSnapshotSection[];

/** Respuestas indexadas por id de ítem del snapshot. */
export type ChecklistAnswers = Record<string, ChecklistAnswer>;

/** Encabezado del documento. Todo opcional: el operador llena lo que aplica. */
export interface ChecklistHeader {
  area_empresa?: string;
  faena?: string;
  tipo_vehiculo?: string;
  patente?: string;
  kilometraje_horas?: string;
  lugar_operacion?: string;
  hora?: string;
}

// ── Plantilla hidratada (catálogo vivo) ────────────────────────────────────

export interface ChecklistTemplateItem extends ChecklistSnapshotItem {
  is_active: boolean;
}

export interface ChecklistTemplateSection {
  id: string;
  title: string;
  sort_order: number;
  items: ChecklistTemplateItem[];
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  subtitle: string | null;
  version: number;
  answer_type: ChecklistAnswerType;
  is_active: boolean;
  sections: ChecklistTemplateSection[];
}

// ── Documento hidratado (lo que consume la UI) ─────────────────────────────

export interface Checklist extends Omit<ChecklistRow, 'items_snapshot' | 'answers' | 'header' | 'status'> {
  status: ChecklistStatus;
  items_snapshot: ChecklistItemsSnapshot;
  answers: ChecklistAnswers;
  header: ChecklistHeader;
}

/** Fila del listado: el documento más los datos denormalizados que se muestran. */
export interface ChecklistListItem extends Checklist {
  template_name: string;
  template_answer_type: ChecklistAnswerType;
  crane_label: string | null;
  service_folio: string | null;
}
