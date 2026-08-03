import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  answerTypeForSnapshotItem,
  buildItemsSnapshot,
  countAnsweredItems,
  countSnapshotItems,
  deriveCraneHeader,
  describeCrane,
  getAnswerOptions,
  getChecklistReadiness,
  isAnswerValidFor,
  isUniqueViolation,
  resolveAnswerType,
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
          answer_type: null,
          items: [
            { id: 'i-b', label: 'Baliza', sort_order: 2, risk_answer: null, is_active: true, answer_type: null },
            { id: 'i-a', label: 'Radio', sort_order: 1, risk_answer: null, is_active: true, answer_type: null },
            { id: 'i-off', label: 'Ítem retirado', sort_order: 3, risk_answer: null, is_active: false, answer_type: null },
          ],
        },
        {
          id: 'sec-1',
          title: 'DOCUMENTACIÓN',
          sort_order: 1,
          answer_type: null,
          items: [
            { id: 'i-doc2', label: 'Revisión técnica', sort_order: 2, risk_answer: null, is_active: true, answer_type: null },
            { id: 'i-doc1', label: 'Permiso de circulación', sort_order: 1, risk_answer: null, is_active: true, answer_type: null },
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
          answer_type: null,
          items: [{ id: 'i-1', label: 'Extintor', sort_order: 1, risk_answer: null, is_active: true, answer_type: null }],
        },
        {
          id: 'sec-vacia',
          title: 'Toda desactivada',
          sort_order: 2,
          answer_type: null,
          items: [{ id: 'i-2', label: 'Obsoleto', sort_order: 1, risk_answer: null, is_active: false, answer_type: null }],
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
          answer_type: null,
          items: [
            { id: 'f1', label: '¿Síntomas de fatiga?', sort_order: 1, risk_answer: 'si', is_active: true, answer_type: null },
            { id: 'f3', label: '¿Descansó bien?', sort_order: 2, risk_answer: 'no', is_active: true, answer_type: null },
          ],
        },
      ],
    }));

    expect(snapshot[0].items.map((i) => i.risk_answer)).toEqual(['si', 'no']);
  });
});

// ── Cascada de answer_type ────────────────────────────────────────────────
// El pre-operacional mezcla dos naturalezas: la sección documental se responde
// vigente/no vigente y las cinco de estado físico bueno/malo.

describe('resolveAnswerType', () => {
  const tpl = { answer_type: 'bueno_malo_na' } as const;

  it('el ítem gana sobre la sección y sobre la plantilla', () => {
    expect(resolveAnswerType(
      { answer_type: 'si_no_na' },
      { answer_type: 'vigente_no_na' },
      tpl,
    )).toBe('si_no_na');
  });

  it('ítem en NULL hereda de la sección', () => {
    expect(resolveAnswerType(
      { answer_type: null },
      { answer_type: 'vigente_no_na' },
      tpl,
    )).toBe('vigente_no_na');
  });

  it('ítem y sección en NULL heredan de la plantilla', () => {
    expect(resolveAnswerType({ answer_type: null }, { answer_type: null }, tpl))
      .toBe('bueno_malo_na');
  });

  it('tolera ausencia de ítem o de sección (la Fase 5 podrá editar cualquier nivel)', () => {
    expect(resolveAnswerType(null, { answer_type: 'vigente_no_na' }, tpl)).toBe('vigente_no_na');
    expect(resolveAnswerType(undefined, undefined, tpl)).toBe('bueno_malo_na');
  });
});

describe('buildItemsSnapshot congela el answer_type resuelto', () => {
  // Réplica de la estructura real del pre-operacional v2: 6 secciones, 32 ítems,
  // la primera documental.
  const PREOP_SECTIONS: Array<[string, number, string[]]> = [
    ['DOCUMENTACIÓN DEL VEHÍCULO', 1, [
      'Permiso de Circulación al día',
      'Revisión Técnica y de Gases vigente',
      'Seguro Obligatorio (SOAP) vigente',
      'Licencia de Conducir (Clase A4 o A5)',
    ]],
    ['EQUIPAMIENTO MINERO', 2, ['a', 'b', 'c', 'd', 'e']],
    ['KIT INVERNAL', 3, ['a', 'b', 'c', 'd', 'e']],
    ['ESTADO DEL VEHÍCULO Y CABINA', 4, ['a', 'b', 'c', 'd', 'e', 'f']],
    ['SISTEMA HIDRÁULICO', 5, ['a', 'b', 'c', 'd', 'e', 'f', 'g']],
    ['SEGURIDAD Y EMERGENCIA', 6, ['a', 'b', 'c', 'd', 'e']],
  ];

  const preop = template({
    version: 2,
    sections: PREOP_SECTIONS.map(([title, order, labels]) => ({
      id: `sec-${order}`,
      title,
      sort_order: order,
      // Solo la documental lleva valor propio; el resto hereda.
      answer_type: order === 1 ? ('vigente_no_na' as const) : null,
      items: labels.map((label, index) => ({
        id: `i-${order}-${index}`,
        label,
        sort_order: index + 1,
        risk_answer: null,
        is_active: true,
        answer_type: null,
      })),
    })),
  });

  it('los 4 ítems documentales quedan en vigente_no_na y los 28 restantes en bueno_malo_na', () => {
    const snapshot = buildItemsSnapshot(preop);
    const items = snapshot.flatMap((s) => s.items);

    expect(items).toHaveLength(32);
    expect(snapshot[0].items).toHaveLength(4);
    expect(snapshot[0].items.every((i) => i.answer_type === 'vigente_no_na')).toBe(true);

    const resto = snapshot.slice(1).flatMap((s) => s.items);
    expect(resto).toHaveLength(28);
    expect(resto.every((i) => i.answer_type === 'bueno_malo_na')).toBe(true);
  });

  it('la sección también guarda su tipo resuelto', () => {
    const snapshot = buildItemsSnapshot(preop);
    expect(snapshot[0].answer_type).toBe('vigente_no_na');
    expect(snapshot[1].answer_type).toBe('bueno_malo_na');
  });

  it('fatiga no sufre regresión: sus 6 ítems siguen en si_no_na', () => {
    const fatiga = template({
      id: 'fatiga_somnolencia',
      answer_type: 'si_no_na',
      sections: [{
        id: 'f-sec',
        title: 'Encuesta al conductor',
        sort_order: 1,
        answer_type: null,
        items: Array.from({ length: 6 }, (_, i) => ({
          id: `f-${i}`,
          label: `Pregunta ${i + 1}`,
          sort_order: i + 1,
          risk_answer: null,
          is_active: true,
          answer_type: null,
        })),
      }],
    });

    const items = buildItemsSnapshot(fatiga).flatMap((s) => s.items);
    expect(items).toHaveLength(6);
    expect(items.every((i) => i.answer_type === 'si_no_na')).toBe(true);
  });
});

describe('answerTypeForSnapshotItem', () => {
  it('un documento de la v1 se sigue renderizando con SU tipo, no con el de la v2', () => {
    // Snapshot creado antes de esta migración: sin answer_type en ningún nivel.
    // Debe caer al answer_type con el que se creó el documento (v1), aunque el
    // maestro ya vaya en la v2 con la sección documental en vigente_no_na.
    const itemV1 = { id: 'x', label: 'Permiso', sort_order: 1, risk_answer: null };
    const sectionV1 = { id: 's', title: 'Documentación', sort_order: 1, items: [itemV1] };

    expect(answerTypeForSnapshotItem(itemV1, sectionV1, 'bueno_malo_na')).toBe('bueno_malo_na');
  });

  it('un documento nuevo usa el tipo congelado en el ítem', () => {
    const item = {
      id: 'x', label: 'SOAP', sort_order: 1, risk_answer: null,
      answer_type: 'vigente_no_na' as const,
    };
    expect(answerTypeForSnapshotItem(item, undefined, 'bueno_malo_na')).toBe('vigente_no_na');
  });

  it('cae a la sección cuando el ítem no lo trae', () => {
    const item = { id: 'x', label: 'SOAP', sort_order: 1, risk_answer: null };
    const section = {
      id: 's', title: 'Documentación', sort_order: 1,
      answer_type: 'vigente_no_na' as const, items: [item],
    };
    expect(answerTypeForSnapshotItem(item, section, 'bueno_malo_na')).toBe('vigente_no_na');
  });
});

describe('derivación desde el catálogo de grúas', () => {
  const crane = {
    license_plate: '  TDCJ-46  ',
    brand: 'Mercedes-Benz',
    model: 'Actros',
    type: 'heavy',
  };

  it('la patente va sin espacios y el tipo con su etiqueta legible', () => {
    const header = deriveCraneHeader(crane);
    expect(header.patente).toBe('TDCJ-46');
    // 'heavy' -> 'Pesada', la misma etiqueta que usa el resto de la UI
    // (CRANE_TYPE_LABELS en utils/craneType).
    expect(header.tipo_vehiculo).toBe('Pesada');
  });

  it('cambiar de grúa re-deriva patente y tipo', () => {
    const otra = { license_plate: 'GHIJ-99', brand: 'Ford', model: 'Cargo', type: 'medium' };
    const header = { ...deriveCraneHeader(crane), faena: 'Los Pelambres' };

    const actualizado = { ...header, ...deriveCraneHeader(otra) };

    expect(actualizado.patente).toBe('GHIJ-99');
    expect(actualizado.tipo_vehiculo).toBe('Mediana');
    // Lo que el operador escribió a mano no se pierde al cambiar la grúa.
    expect(actualizado.faena).toBe('Los Pelambres');
  });

  it('sin grúa no inventa datos', () => {
    expect(deriveCraneHeader(null)).toEqual({ patente: '', tipo_vehiculo: '' });
    expect(describeCrane(null)).toBe('');
  });

  it('describeCrane arma el rótulo de una línea', () => {
    expect(describeCrane(crane)).toBe('TDCJ-46 · Mercedes-Benz Actros · Pesada');
  });

  it('un tipo desconocido no rompe: cae al valor crudo', () => {
    expect(deriveCraneHeader({ license_plate: 'X', type: 'inexistente' }).tipo_vehiculo)
      .toBe('inexistente');
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

  it("acepta 'vigente' y 'no_vigente' como respuestas de la sección documental", () => {
    const mixto: ChecklistItemsSnapshot = [
      {
        id: 'doc',
        title: 'DOCUMENTACIÓN DEL VEHÍCULO',
        sort_order: 1,
        answer_type: 'vigente_no_na',
        items: [
          { id: 'soap', label: 'SOAP vigente', sort_order: 1, risk_answer: null, answer_type: 'vigente_no_na' },
          { id: 'rt', label: 'Revisión técnica', sort_order: 2, risk_answer: null, answer_type: 'vigente_no_na' },
        ],
      },
      {
        id: 'fisico',
        title: 'ESTADO DEL VEHÍCULO',
        sort_order: 2,
        answer_type: 'bueno_malo_na',
        items: [{ id: 'frenos', label: 'Frenos', sort_order: 1, risk_answer: null, answer_type: 'bueno_malo_na' }],
      },
    ];

    const readiness = getChecklistReadiness(
      mixto,
      { soap: 'vigente', rt: 'no_vigente', frenos: 'bueno' },
      'firma',
    );

    expect(readiness.ready).toBe(true);
    expect(readiness.answeredCount).toBe(3);
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

  it("'vigente_no_na' entrega VIGENTE / NO VIGENTE / N-A", () => {
    const options = getAnswerOptions('vigente_no_na');
    expect(options.map((o) => o.value)).toEqual(['vigente', 'no_vigente', 'na']);
    // Sin abreviar: es la palabra que queda en el documento firmado.
    expect(options.map((o) => o.label)).toEqual(['VIGENTE', 'NO VIGENTE', 'N/A']);
    expect(options.map((o) => o.ariaLabel)).toEqual(['Vigente', 'No vigente', 'No aplica']);
    expect(options.map((o) => o.tone)).toEqual(['positive', 'negative', 'neutral']);
  });

  it('no se cruzan las respuestas entre tipos', () => {
    expect(isAnswerValidFor('si_no_na', 'si')).toBe(true);
    expect(isAnswerValidFor('si_no_na', 'bueno')).toBe(false);
    expect(isAnswerValidFor('bueno_malo_na', 'bueno')).toBe(true);
    expect(isAnswerValidFor('bueno_malo_na', 'si')).toBe(false);
    // Un SOAP no puede quedar respondido "malo": ese es el bug que se corrige.
    expect(isAnswerValidFor('vigente_no_na', 'malo')).toBe(false);
    expect(isAnswerValidFor('vigente_no_na', 'vigente')).toBe(true);
    expect(isAnswerValidFor('vigente_no_na', 'no_vigente')).toBe(true);
    expect(isAnswerValidFor('bueno_malo_na', 'vigente')).toBe(false);
    // 'na' es la única compartida por los tres.
    expect(isAnswerValidFor('si_no_na', 'na')).toBe(true);
    expect(isAnswerValidFor('bueno_malo_na', 'na')).toBe(true);
    expect(isAnswerValidFor('vigente_no_na', 'na')).toBe(true);
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
