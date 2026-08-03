/**
 * Lógica pura del módulo de Checklists. Sin React, sin Supabase: todo lo que
 * decide qué se guarda, qué se muestra y cuándo se puede firmar vive acá para
 * poder probarse sin levantar la app ni operar en terreno.
 */

import { businessClock } from '@/utils/businessClock';
import { getCraneTypeLabel } from '@/utils/craneType';
import type {
  ChecklistAnswer,
  ChecklistAnswerType,
  ChecklistAnswers,
  ChecklistItemsSnapshot,
  ChecklistSnapshotItem,
  ChecklistSnapshotSection,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistTemplateSection,
} from '@/types/checklists';

/**
 * Resuelve el tipo de respuesta en cascada: del nivel más específico al más
 * general. NULL en cualquier nivel significa "hereda".
 *
 *   ítem.answer_type -> sección.answer_type -> plantilla.answer_type
 *
 * Existe porque una plantilla puede mezclar naturalezas. En el pre-operacional,
 * la sección documental (permiso de circulación, revisión técnica, SOAP,
 * licencia) se responde vigente/no vigente: un permiso no está "bueno" ni
 * "malo", y firmar "M" en un SOAP equivale a declarar que el camión salió sin
 * seguro.
 *
 * El nivel de ÍTEM todavía no lo usa nadie, pero la cascada ya lo contempla para
 * que la pantalla de administración del maestro (Fase 5) pueda editar ambos
 * niveles sin otra migración.
 */
export const resolveAnswerType = (
  item: Pick<ChecklistTemplateItem, 'answer_type'> | null | undefined,
  section: Pick<ChecklistTemplateSection, 'answer_type'> | null | undefined,
  template: Pick<ChecklistTemplate, 'answer_type'>,
): ChecklistAnswerType =>
  item?.answer_type ?? section?.answer_type ?? template.answer_type;

/**
 * Tipo de respuesta con el que se DEBE renderizar un ítem ya guardado.
 *
 * Lee el valor congelado en el snapshot y solo cae al de la plantilla cuando el
 * documento es anterior a que el snapshot guardara answer_type. Nunca recalcula
 * la cascada contra el maestro vivo.
 */
export const answerTypeForSnapshotItem = (
  item: Pick<ChecklistSnapshotItem, 'answer_type'>,
  section: Pick<ChecklistSnapshotSection, 'answer_type'> | null | undefined,
  templateAnswerType: ChecklistAnswerType,
): ChecklistAnswerType =>
  item.answer_type ?? section?.answer_type ?? templateAnswerType;

/**
 * Congela la plantilla viva en el snapshot que se guarda con el documento.
 *
 * Solo entran los ítems ACTIVOS, ordenados por sort_order, igual que las
 * secciones. Una sección que se queda sin ítems activos NO se incluye: sería un
 * paso vacío en el formulario y un bloque vacío en el PDF de la Fase 3.
 *
 * El answer_type se guarda YA RESUELTO en cada ítem. A partir de acá el
 * formulario renderiza desde el snapshot y nunca vuelve a mirar el maestro: si
 * un admin desactiva un ítem o le cambia el tipo de respuesta mientras el
 * operador llena, el borrador abierto sigue mostrando exactamente lo que empezó
 * a responder.
 */
export const buildItemsSnapshot = (template: ChecklistTemplate): ChecklistItemsSnapshot =>
  [...template.sections]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((section) => ({
      id: section.id,
      title: section.title,
      sort_order: section.sort_order,
      answer_type: resolveAnswerType(null, section, template),
      items: [...section.items]
        .filter((item) => item.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => ({
          id: item.id,
          label: item.label,
          sort_order: item.sort_order,
          risk_answer: item.risk_answer,
          answer_type: resolveAnswerType(item, section, template),
        })),
    }))
    .filter((section) => section.items.length > 0);

export interface ChecklistAnswerOption {
  value: ChecklistAnswer;
  /** Texto del botón: corto a propósito, se toca con guantes. */
  label: string;
  /** Etiqueta accesible completa (el botón dice "B", el lector dice "Bueno"). */
  ariaLabel: string;
  tone: 'positive' | 'negative' | 'neutral';
}

const SI_NO_NA: ChecklistAnswerOption[] = [
  { value: 'si', label: 'SÍ', ariaLabel: 'Sí', tone: 'positive' },
  { value: 'no', label: 'NO', ariaLabel: 'No', tone: 'negative' },
  { value: 'na', label: 'N/A', ariaLabel: 'No aplica', tone: 'neutral' },
];

const BUENO_MALO_NA: ChecklistAnswerOption[] = [
  { value: 'bueno', label: 'B', ariaLabel: 'Bueno', tone: 'positive' },
  { value: 'malo', label: 'M', ariaLabel: 'Malo', tone: 'negative' },
  { value: 'na', label: 'N/A', ariaLabel: 'No aplica', tone: 'neutral' },
];

// Documentación del vehículo: un permiso de circulación no está "bueno" ni
// "malo". El rótulo va completo aunque sea largo — es la palabra que queda en el
// documento firmado y no se abrevia.
const VIGENTE_NO_NA: ChecklistAnswerOption[] = [
  { value: 'vigente', label: 'VIGENTE', ariaLabel: 'Vigente', tone: 'positive' },
  { value: 'no_vigente', label: 'NO VIGENTE', ariaLabel: 'No vigente', tone: 'negative' },
  { value: 'na', label: 'N/A', ariaLabel: 'No aplica', tone: 'neutral' },
];

/** Opciones que ve el operador según el answer_type ya resuelto. */
export const getAnswerOptions = (answerType: ChecklistAnswerType): ChecklistAnswerOption[] => {
  switch (answerType) {
    case 'bueno_malo_na': return BUENO_MALO_NA;
    case 'vigente_no_na': return VIGENTE_NO_NA;
    default: return SI_NO_NA;
  }
};

/** Etiqueta legible de una respuesta guardada (listado y vista de solo lectura). */
export const getAnswerLabel = (answer: ChecklistAnswer): string => {
  switch (answer) {
    case 'si': return 'Sí';
    case 'no': return 'No';
    case 'bueno': return 'Bueno';
    case 'malo': return 'Malo';
    case 'vigente': return 'Vigente';
    case 'no_vigente': return 'No vigente';
    case 'na': return 'No aplica';
    default: return String(answer);
  }
};

/** Una respuesta pertenece al answer_type de su plantilla. */
export const isAnswerValidFor = (answerType: ChecklistAnswerType, answer: string): boolean =>
  getAnswerOptions(answerType).some((option) => option.value === answer);

export const countSnapshotItems = (snapshot: ChecklistItemsSnapshot): number =>
  snapshot.reduce((total, section) => total + section.items.length, 0);

export const countAnsweredItems = (
  snapshot: ChecklistItemsSnapshot,
  answers: ChecklistAnswers,
): number =>
  snapshot.reduce(
    (total, section) => total + section.items.filter((item) => Boolean(answers[item.id])).length,
    0,
  );

/** Ítems del snapshot todavía sin responder, en orden de aparición. */
export const getUnansweredItems = (
  snapshot: ChecklistItemsSnapshot,
  answers: ChecklistAnswers,
) =>
  snapshot.flatMap((section) =>
    section.items
      .filter((item) => !answers[item.id])
      .map((item) => ({ sectionId: section.id, sectionTitle: section.title, ...item })),
  );

export interface ChecklistReadiness {
  ready: boolean;
  answeredCount: number;
  totalCount: number;
  missingAnswers: number;
  missingOperatorSignature: boolean;
  /** Índice de la primera sección con ítems pendientes, para saltar ahí. */
  firstIncompleteSectionIndex: number;
}

/**
 * Regla de cierre: los checklists son opcionales, pero uno firmado a medias no
 * sirve como respaldo. Para firmar hacen falta TODOS los ítems respondidos y la
 * firma del operador. La del revisor es opcional y no participa.
 */
export const getChecklistReadiness = (
  snapshot: ChecklistItemsSnapshot,
  answers: ChecklistAnswers,
  operatorSignature: string | null | undefined,
): ChecklistReadiness => {
  const totalCount = countSnapshotItems(snapshot);
  const answeredCount = countAnsweredItems(snapshot, answers);
  const missingAnswers = totalCount - answeredCount;
  const missingOperatorSignature = !operatorSignature;
  const firstIncompleteSectionIndex = snapshot.findIndex((section) =>
    section.items.some((item) => !answers[item.id]),
  );

  return {
    // Un snapshot vacío no es "completo": no habría nada que respaldar.
    ready: totalCount > 0 && missingAnswers === 0 && !missingOperatorSignature,
    answeredCount,
    totalCount,
    missingAnswers,
    missingOperatorSignature,
    firstIncompleteSectionIndex,
  };
};

/**
 * Momento y día operacional del checklist, siempre en TZ del negocio.
 *
 * `performed_date` NO se deriva en Postgres (AT TIME ZONE no es IMMUTABLE, ver
 * la migración de Fase 1) ni del reloj del navegador: sale de businessClock, que
 * es lo que hace que un checklist llenado a las 23:50 en Chile quede en el día
 * correcto aunque el dispositivo esté en otra zona.
 */
export const resolvePerformedMoment = (): { performed_at: string; performed_date: string } => ({
  performed_at: businessClock.nowISO(),
  performed_date: businessClock.today(),
});

/** Hora 'HH:mm' del negocio, para prellenar el encabezado. */
export const businessTimeNow = (): string => businessClock.format(businessClock.now(), 'HH:mm');

// ── Derivación desde la grúa ───────────────────────────────────────────────

export interface ChecklistCraneSource {
  license_plate: string;
  brand?: string | null;
  model?: string | null;
  type?: string | null;
}

/**
 * Patente y tipo de vehículo derivados del catálogo `cranes`.
 *
 * En el formulario en papel el operador escribía ambos a mano porque no había
 * catálogo; acá la grúa es la fuente de verdad y escribirlos de nuevo solo
 * ofrece la ocasión de equivocarse.
 *
 * Se DERIVAN en pantalla pero se CONGELAN en la fila: si mañana se corrige la
 * ficha de la grúa, el documento ya firmado tiene que seguir diciendo lo que se
 * firmó.
 */
export const deriveCraneHeader = (
  crane: ChecklistCraneSource | null | undefined,
): { patente: string; tipo_vehiculo: string } => ({
  patente: crane?.license_plate?.trim() ?? '',
  tipo_vehiculo: crane ? getCraneTypeLabel(crane.type) : '',
});

/** Rótulo de una línea: "TDCJ-46 · Mercedes-Benz Actros · Pesada". */
export const describeCrane = (crane: ChecklistCraneSource | null | undefined): string => {
  if (!crane) return '';
  const marcaModelo = [crane.brand, crane.model].filter(Boolean).join(' ');
  return [crane.license_plate?.trim(), marcaModelo, getCraneTypeLabel(crane.type)]
    .filter(Boolean)
    .join(' · ');
};

/**
 * 23505 = unique_violation. Al firmar un pre-operacional puede chocar con
 * ux_checklists_preop_crane_day (uno por grúa por día). El operador no tiene por
 * qué leer un error de Postgres.
 */
export const isUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === '23505';
};
