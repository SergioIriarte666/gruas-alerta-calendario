import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildItemsSnapshot,
  countAnsweredItems,
  countSnapshotItems,
  getAnswerOptions,
  getChecklistReadiness,
  isAnswerValidFor,
  isUniqueViolation,
  resolvePerformedMoment,
} from '@/utils/checklists/checklistLogic';
import { businessClock } from '@/utils/businessClock';
import type {
  ChecklistAnswers,
  ChecklistItemsSnapshot,
  ChecklistTemplate,
} from '@/types/checklists';

const template = (overrides: Partial<ChecklistTemplate> = {}): ChecklistTemplate => ({
  id: 'preoperacional_grua_cama',
  name: 'Checklist Pre-Operacional: Camión Grúa Cama (Chile)',
  subtitle: null,
  version: 1,
  answer_type: 'bueno_malo_na',
  is_active: true,
  sections: [],
  ...overrides,
});

describe('buildItemsSnapshot', () => {
  it('incluye SOLO los ítems activos, ordenados por sort_order', () => {
    const snapshot = buildItemsSnapshot(template({
      sections: [
        {
          id: 'sec-2',
          title: 'EQUIPAMIENTO MINERO',
          sort_order: 2,
          items: [
            { id: 'i-b', label: 'Baliza', sort_order: 2, risk_answer: null, is_active: true },
            { id: 'i-a', label: 'Radio', sort_order: 1, risk_answer: null, is_active: true },
            { id: 'i-off', label: 'Ítem retirado', sort_order: 3, risk_answer: null, is_active: false },
          ],
        },
        {
          id: 'sec-1',
          title: 'DOCUMENTACIÓN',
          sort_order: 1,
          items: [
            { id: 'i-doc2', label: 'Revisión técnica', sort_order: 2, risk_answer: null, is_active: true },
            { id: 'i-doc1', label: 'Permiso de circulación', sort_order: 1, risk_answer: null, is_active: true },
          ],
        },
      ],
    }));

    // Secciones ordenadas por sort_order, no por el orden de llegada.
    expect(snapshot.map((s) => s.id)).toEqual(['sec-1', 'sec-2']);
    expect(snapshot[0].items.map((i) => i.label)).toEqual([
      'Permiso de circulación',
      'Revisión técnica',
    ]);
    // El inactivo no entra al documento.
    expect(snapshot[1].items.map((i) => i.id)).toEqual(['i-a', 'i-b']);
    expect(snapshot.flatMap((s) => s.items).some((i) => i.id === 'i-off')).toBe(false);
    expect(countSnapshotItems(snapshot)).toBe(4);
  });

  it('descarta una sección que se quedó sin ítems activos', () => {
    const snapshot = buildItemsSnapshot(template({
      sections: [
        {
          id: 'sec-viva',
          title: 'Viva',
          sort_order: 1,
          items: [{ id: 'i-1', label: 'Extintor', sort_order: 1, risk_answer: null, is_active: true }],
        },
        {
          id: 'sec-vacia',
          title: 'Toda desactivada',
          sort_order: 2,
          items: [{ id: 'i-2', label: 'Obsoleto', sort_order: 1, risk_answer: null, is_active: false }],
        },
      ],
    }));

    expect(snapshot.map((s) => s.id)).toEqual(['sec-viva']);
  });

  it('conserva risk_answer tal cual viene del maestro', () => {
    const snapshot = buildItemsSnapshot(template({
      id: 'fatiga_somnolencia',
      answer_type: 'si_no_na',
      sections: [
        {
          id: 'sec-1',
          title: 'Encuesta al conductor',
          sort_order: 1,
          items: [
            { id: 'f1', label: '¿Síntomas de fatiga?', sort_order: 1, risk_answer: 'si', is_active: true },
            { id: 'f3', label: '¿Descansó bien?', sort_order: 2, risk_answer: 'no', is_active: true },
          ],
        },
      ],
    }));

    expect(snapshot[0].items.map((i) => i.risk_answer)).toEqual(['si', 'no']);
  });
});

describe('performed_date con businessClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // La TZ del negocio es America/Santiago (fallback de businessClock cuando no
  // hay company_data cargada). En agosto Chile está en UTC-4.
  const atUtc = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  it('23:50 en Chile cae en el día que el operador está viviendo, no en el siguiente UTC', () => {
    // 2026-08-03 23:50 en Santiago = 2026-08-04 03:50 UTC.
    atUtc('2026-08-04T03:50:00Z');
    const { performed_date, performed_at } = resolvePerformedMoment();
    expect(performed_date).toBe('2026-08-03');
    expect(performed_at.startsWith('2026-08-03T23:50')).toBe(true);
  });

  it('00:10 en Chile ya es el día siguiente', () => {
    // 2026-08-04 00:10 en Santiago = 2026-08-04 04:10 UTC.
    atUtc('2026-08-04T04:10:00Z');
    expect(resolvePerformedMoment().performed_date).toBe('2026-08-04');
  });

  it('mediodía no tiene ambigüedad', () => {
    atUtc('2026-08-04T16:00:00Z'); // 12:00 en Santiago
    expect(resolvePerformedMoment().performed_date).toBe('2026-08-04');
  });

  it('el día operacional lo decide la TZ del negocio y no la del dispositivo', () => {
    atUtc('2026-08-04T03:50:00Z');
    // businessClock.today() es la fuente única: si esto se hiciera con
    // new Date().toISOString().slice(0,10) daría 2026-08-04 y el checklist
    // quedaría en la jornada equivocada.
    expect(resolvePerformedMoment().performed_date).toBe(businessClock.today());
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-08-04');
  });
});

describe('getChecklistReadiness', () => {
  const snapshot: ChecklistItemsSnapshot = [
    {
      id: 's1',
      title: 'Documentación',
      sort_order: 1,
      items: [
        { id: 'a', label: 'Permiso', sort_order: 1, risk_answer: null },
        { id: 'b', label: 'Revisión', sort_order: 2, risk_answer: null },
      ],
    },
    {
      id: 's2',
      title: 'Seguridad',
      sort_order: 2,
      items: [{ id: 'c', label: 'Extintor', sort_order: 1, risk_answer: null }],
    },
  ];

  const full: ChecklistAnswers = { a: 'bueno', b: 'malo', c: 'na' };

  it('falta un ítem -> no se puede firmar', () => {
    const readiness = getChecklistReadiness(snapshot, { a: 'bueno', b: 'malo' }, 'data:image/png;base64,x');
    expect(readiness.ready).toBe(false);
    expect(readiness.missingAnswers).toBe(1);
    expect(readiness.answeredCount).toBe(2);
    expect(readiness.totalCount).toBe(3);
    // Apunta a la sección donde está el pendiente, para poder saltar ahí.
    expect(readiness.firstIncompleteSectionIndex).toBe(1);
  });

  it('falta la firma del operador -> no se puede firmar', () => {
    const readiness = getChecklistReadiness(snapshot, full, '');
    expect(readiness.ready).toBe(false);
    expect(readiness.missingOperatorSignature).toBe(true);
    expect(readiness.missingAnswers).toBe(0);
  });

  it('todo respondido + firma del operador -> listo', () => {
    const readiness = getChecklistReadiness(snapshot, full, 'data:image/png;base64,x');
    expect(readiness.ready).toBe(true);
    expect(readiness.firstIncompleteSectionIndex).toBe(-1);
  });

  it('la firma del revisor NO participa de la regla de cierre', () => {
    // Sin reviewer_name ni reviewer_signature en ninguna parte del cálculo.
    expect(getChecklistReadiness(snapshot, full, 'firma').ready).toBe(true);
  });

  it('un snapshot vacío no cuenta como completo', () => {
    expect(getChecklistReadiness([], {}, 'firma').ready).toBe(false);
  });

  it('cuenta correctamente los respondidos', () => {
    expect(countAnsweredItems(snapshot, { a: 'bueno' })).toBe(1);
    expect(countAnsweredItems(snapshot, full)).toBe(3);
  });
});

describe('answer_type -> opciones', () => {
  it("'si_no_na' entrega SÍ / NO / N-A", () => {
    const options = getAnswerOptions('si_no_na');
    expect(options.map((o) => o.value)).toEqual(['si', 'no', 'na']);
    expect(options.map((o) => o.label)).toEqual(['SÍ', 'NO', 'N/A']);
  });

  it("'bueno_malo_na' entrega B / M / N-A", () => {
    const options = getAnswerOptions('bueno_malo_na');
    expect(options.map((o) => o.value)).toEqual(['bueno', 'malo', 'na']);
    expect(options.map((o) => o.label)).toEqual(['B', 'M', 'N/A']);
    // El rótulo corto es para el guante; el lector de pantalla dice la palabra.
    expect(options.map((o) => o.ariaLabel)).toEqual(['Bueno', 'Malo', 'No aplica']);
  });

  it('no se cruzan las respuestas entre plantillas', () => {
    expect(isAnswerValidFor('si_no_na', 'si')).toBe(true);
    expect(isAnswerValidFor('si_no_na', 'bueno')).toBe(false);
    expect(isAnswerValidFor('bueno_malo_na', 'bueno')).toBe(true);
    expect(isAnswerValidFor('bueno_malo_na', 'si')).toBe(false);
    // 'na' es la única compartida por ambas.
    expect(isAnswerValidFor('si_no_na', 'na')).toBe(true);
    expect(isAnswerValidFor('bueno_malo_na', 'na')).toBe(true);
  });
});

describe('isUniqueViolation', () => {
  it('reconoce el 23505 de Postgres', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key value' })).toBe(true);
  });

  it('no confunde otros errores', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation({ code: 'PGRST116' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
