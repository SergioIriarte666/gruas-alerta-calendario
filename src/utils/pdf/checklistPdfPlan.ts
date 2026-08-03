/**
 * Modelo del PDF de checklist, resuelto ANTES de dibujar.
 *
 * Se separa del generador a propósito: acá vive lo que decide qué dice el
 * documento (qué columnas lleva cada sección, qué nota va al pie, qué firmas se
 * dibujan) y eso se puede probar sin levantar jsPDF ni comparar imágenes.
 *
 * Todo sale del items_snapshot del registro, NUNCA de la plantilla viva: un PDF
 * regenerado dentro de dos años tiene que salir idéntico al que se firmó.
 */

import { normalizeRut } from '@/utils/rutFormatter';
import { businessClock } from '@/utils/businessClock';
import { answerTypeForSnapshotItem } from '@/utils/checklists/checklistLogic';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import type {
  ChecklistAnswerType,
  ChecklistAnswers,
  ChecklistHeader,
  ChecklistItemsSnapshot,
} from '@/types/checklists';

/** Rótulos de las tres columnas de respuesta de una sección. */
export interface ChecklistPdfColumns {
  positive: string;
  negative: string;
  na: string;
  /** Valores de answers que marcan cada columna, en el mismo orden. */
  values: [string, string, string];
}

/**
 * Un permiso de circulación no está "bueno": está vigente o no lo está, y esa
 * es la palabra que respalda el documento ante la faena. "NO VIGENTE" va
 * completo, nunca abreviado.
 */
const COLUMNS_BY_ANSWER_TYPE: Record<ChecklistAnswerType, ChecklistPdfColumns> = {
  vigente_no_na: {
    positive: 'VIGENTE',
    negative: 'NO VIGENTE',
    na: 'N/A',
    values: ['vigente', 'no_vigente', 'na'],
  },
  bueno_malo_na: {
    positive: 'BUENO (B)',
    negative: 'MALO (M)',
    na: 'NO APLICA (N/A)',
    values: ['bueno', 'malo', 'na'],
  },
  si_no_na: {
    positive: 'SI',
    negative: 'NO',
    na: 'N/A',
    values: ['si', 'no', 'na'],
  },
};

export const getPdfColumns = (answerType: ChecklistAnswerType): ChecklistPdfColumns =>
  COLUMNS_BY_ANSWER_TYPE[answerType] ?? COLUMNS_BY_ANSWER_TYPE.si_no_na;

export interface ChecklistPdfRow {
  /** Correlativo dentro de la sección, como en el formulario en papel. */
  index: number;
  label: string;
  /** Cuál de las tres columnas se marca. -1 si el ítem quedó sin responder. */
  markedColumn: number;
}

export interface ChecklistPdfSection {
  title: string;
  answerType: ChecklistAnswerType;
  columns: ChecklistPdfColumns;
  rows: ChecklistPdfRow[];
}

export interface ChecklistPdfSignature {
  label: string;
  signature?: string;
  name?: string;
  rut?: string;
}

export interface ChecklistPdfPlan {
  templateId: string;
  templateVersion: number;
  documentTitle: string;
  /** Código visible en el recuadro superior. */
  code: string;
  performedLabel: string;
  antecedents: Array<[string, string]>;
  sections: ChecklistPdfSection[];
  totalItems: number;
  /** El pre-operacional lleva una columna de observaciones por ítem. */
  hasItemObservationColumn: boolean;
  observations: string | null;
  closingQuestion: { text: string; answer: 'SI' | 'NO' | null } | null;
  footerNote: string | null;
  signatures: ChecklistPdfSignature[];
}

/** Nota literal exigida en el formulario de fatiga. */
export const FATIGA_FOOTER_NOTE =
  'Mediante firma de este documento, doy fe de la veracidad de la información entregada.';

export const PREOP_CLOSING_QUESTION =
  '¿El camión se encuentra en condiciones seguras para operar?';

export interface ChecklistPdfSource {
  id: string;
  template_id: string;
  template_version: number;
  /** answer_type de la plantilla registrada: solo se usa como último recurso. */
  template_answer_type: ChecklistAnswerType;
  template_name: string;
  items_snapshot: ChecklistItemsSnapshot;
  answers: ChecklistAnswers;
  header: ChecklistHeader;
  observations: string | null;
  is_safe_to_operate: boolean | null;
  operator_signature: string | null;
  reviewer_name: string | null;
  reviewer_signature: string | null;
  performed_at: string;
  performed_date: string;
}

export interface ChecklistPdfContext {
  operatorName: string;
  operatorRut: string | null;
  /** Folio del servicio asociado, si el checklist quedó vinculado a uno. */
  serviceFolio?: string | null;
  craneLabel?: string | null;
}

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const pushIfPresent = (
  target: Array<[string, string]>,
  label: string,
  value: unknown,
) => {
  const text = clean(value);
  if (text) target.push([label, text]);
};

/**
 * Arma el modelo del documento.
 *
 * El answer_type de cada sección sale del snapshot (nivel de ítem primero, luego
 * de sección). Solo cuando el snapshot es anterior a que se guardara —documentos
 * de la v1— cae al answer_type de la plantilla registrada en el propio registro.
 */
export const buildChecklistPdfPlan = (
  checklist: ChecklistPdfSource,
  context: ChecklistPdfContext,
): ChecklistPdfPlan => {
  const isPreoperacional = checklist.template_id === CHECKLIST_TEMPLATE_IDS.preoperacional;
  const isFatiga = checklist.template_id === CHECKLIST_TEMPLATE_IDS.fatiga;

  const sections: ChecklistPdfSection[] = checklist.items_snapshot.map((section) => {
    // Una sección puede mezclar ítems de distinto tipo; el encabezado de la
    // tabla se decide con el del primer ítem, que en la práctica es el de la
    // sección. Si no hay ítems, se usa el de la sección o el de la plantilla.
    const answerType = section.items.length > 0
      ? answerTypeForSnapshotItem(section.items[0], section, checklist.template_answer_type)
      : (section.answer_type ?? checklist.template_answer_type);
    const columns = getPdfColumns(answerType);

    return {
      title: section.title,
      answerType,
      columns,
      rows: section.items.map((item, index) => {
        const itemColumns = getPdfColumns(
          answerTypeForSnapshotItem(item, section, checklist.template_answer_type),
        );
        const answer = checklist.answers[item.id];
        return {
          index: index + 1,
          label: item.label,
          markedColumn: answer ? itemColumns.values.indexOf(answer) : -1,
        };
      }),
    };
  });

  const antecedents: Array<[string, string]> = [];
  pushIfPresent(antecedents, 'Faena', checklist.header.faena);
  pushIfPresent(antecedents, 'Área / Empresa', checklist.header.area_empresa);
  pushIfPresent(antecedents, 'Tipo de vehículo', checklist.header.tipo_vehiculo);
  pushIfPresent(antecedents, 'Patente', checklist.header.patente);
  pushIfPresent(antecedents, 'Kilometraje / Horas', checklist.header.kilometraje_horas);
  pushIfPresent(antecedents, 'Lugar de operación', checklist.header.lugar_operacion);
  pushIfPresent(antecedents, 'Hora', checklist.header.hora);
  pushIfPresent(antecedents, 'Operador', context.operatorName);
  if (clean(context.operatorRut)) {
    antecedents.push(['RUT operador', normalizeRut(clean(context.operatorRut))]);
  }
  pushIfPresent(antecedents, 'Folio del servicio', context.serviceFolio);

  const signatures: ChecklistPdfSignature[] = [{
    label: 'Firma del Operador',
    signature: checklist.operator_signature ?? undefined,
    name: clean(context.operatorName) || 'Operador',
    rut: clean(context.operatorRut) || undefined,
  }];

  // El revisor es opcional. Sin firma ni nombre NO se dibuja un recuadro vacío:
  // un cuadro sin rotular en un documento probatorio se lee como una firma que
  // falta, no como una que nunca correspondió.
  if (checklist.reviewer_signature || clean(checklist.reviewer_name)) {
    signatures.push({
      label: 'Revisor / Supervisor',
      signature: checklist.reviewer_signature ?? undefined,
      name: clean(checklist.reviewer_name) || 'Revisor',
    });
  }

  return {
    templateId: checklist.template_id,
    templateVersion: checklist.template_version,
    documentTitle: checklist.template_name,
    code: isPreoperacional ? 'CHK-PREOP' : isFatiga ? 'CHK-FATIGA' : 'CHK',
    performedLabel: businessClock.format(checklist.performed_at, 'dd/MM/yyyy HH:mm'),
    antecedents,
    sections,
    totalItems: sections.reduce((total, section) => total + section.rows.length, 0),
    hasItemObservationColumn: isPreoperacional,
    observations: clean(checklist.observations) || null,
    closingQuestion: isPreoperacional
      ? {
          text: PREOP_CLOSING_QUESTION,
          answer: checklist.is_safe_to_operate === null || checklist.is_safe_to_operate === undefined
            ? null
            : checklist.is_safe_to_operate ? 'SI' : 'NO',
        }
      : null,
    footerNote: isFatiga ? FATIGA_FOOTER_NOTE : null,
    signatures,
  };
};
