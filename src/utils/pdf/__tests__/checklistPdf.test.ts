import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildChecklistPdfPlan,
  getPdfColumns,
  FATIGA_FOOTER_NOTE,
  PREOP_CLOSING_QUESTION,
  type ChecklistPdfSource,
} from '@/utils/pdf/checklistPdfPlan';
import { buildChecklistPdfDocument } from '@/utils/pdf/checklistPdfGenerator';
import type { ChecklistItemsSnapshot } from '@/types/checklists';
import type { CompanyData } from '@/utils/pdf/companyDataFetcher';

// Empresa inyectada para no pegarle a la red desde el test.
const COMPANY: CompanyData = {
  businessName: 'Grúas 5 Norte SpA',
  rut: '76.769.841-0',
  address: 'Panamericana Norte Km. 841, Copiapó',
  phone: '+56 9 0000 0000',
};

const CONTEXT = {
  operatorName: 'Juan Carlos Pérez',
  operatorRut: '12345678-5',
  serviceFolio: 'SRV-7001',
  craneLabel: 'TDCJ-46 · Mercedes-Benz Actros · Pesada',
};

/** Réplica del pre-operacional v2: sección documental + 5 de estado físico. */
const preopSnapshot = (): ChecklistItemsSnapshot => {
  const seccion = (
    id: string,
    title: string,
    order: number,
    answerType: 'vigente_no_na' | 'bueno_malo_na',
    labels: string[],
  ) => ({
    id,
    title,
    sort_order: order,
    answer_type: answerType,
    items: labels.map((label, index) => ({
      id: `${id}-${index}`,
      label,
      sort_order: index + 1,
      risk_answer: null,
      answer_type: answerType,
    })),
  });

  return [
    seccion('s1', 'DOCUMENTACIÓN DEL VEHÍCULO', 1, 'vigente_no_na', [
      'Permiso de Circulación al día',
      'Revisión Técnica y de Gases vigente',
      'Seguro Obligatorio (SOAP) vigente',
      'Licencia de Conducir (Clase A4 o A5)',
    ]),
    seccion('s2', 'EQUIPAMIENTO MINERO, COMUNICACIÓN Y LUCES AUXILIARES', 2, 'bueno_malo_na',
      ['Radio de comunicación', 'Luces frontales', 'Luces traseras', 'Pértiga', 'Baliza']),
    seccion('s3', 'KIT DE CONDUCCIÓN INVERNAL', 3, 'bueno_malo_na',
      ['Caja de invierno', 'Tensores', 'Anticongelante', 'Pala para nieve', '2do. Neumático de Repuesto']),
    seccion('s4', 'ESTADO DEL VEHÍCULO Y CABINA', 4, 'bueno_malo_na',
      ['Niveles de fluidos', 'Neumáticos', 'Luces estándar', 'Alarma de retroceso', 'Espejos', 'Frenos']),
    seccion('s5', 'SISTEMA HIDRÁULICO, PLATAFORMA Y ARRASTRE', 5, 'bueno_malo_na',
      ['Toma de fuerza', 'Cilindros', 'Mangueras', 'Estado de la cama', 'Cable del winche', 'Gancho', 'Eslingas']),
    seccion('s6', 'ELEMENTOS DE SEGURIDAD Y EMERGENCIA', 6, 'bueno_malo_na',
      ['Extintor', 'Triángulos', 'Chaleco', 'Botiquín', 'Cuñas']),
  ];
};

const answersFor = (snapshot: ChecklistItemsSnapshot): Record<string, string> => {
  const answers: Record<string, string> = {};
  snapshot.forEach((section) => {
    section.items.forEach((item, index) => {
      if (section.answer_type === 'vigente_no_na') {
        answers[item.id] = index === 2 ? 'no_vigente' : 'vigente';
      } else {
        answers[item.id] = index === 0 ? 'malo' : 'bueno';
      }
    });
  });
  return answers;
};

const preopChecklist = (overrides: Partial<ChecklistPdfSource> = {}): ChecklistPdfSource => {
  const snapshot = preopSnapshot();
  return {
    id: '11111111-1111-1111-1111-111111111111',
    template_id: 'preoperacional_grua_cama',
    template_version: 2,
    template_answer_type: 'bueno_malo_na',
    template_name: 'Checklist Pre-Operacional: Camión Grúa Cama (Chile)',
    items_snapshot: snapshot,
    answers: answersFor(snapshot),
    header: {
      faena: 'Los Pelambres',
      area_empresa: 'Operaciones',
      tipo_vehiculo: 'Pesada',
      patente: '  TDCJ-46  ',
      kilometraje_horas: '184320',
      lugar_operacion: 'Portería 3',
      hora: '07:15',
    },
    observations: 'Se detecta filtración menor en cilindro derecho.',
    is_safe_to_operate: true,
    operator_signature: null,
    reviewer_name: null,
    reviewer_signature: null,
    performed_at: '2026-08-03T07:15:00-04:00',
    performed_date: '2026-08-03',
    ...overrides,
  };
};

const fatigaChecklist = (overrides: Partial<ChecklistPdfSource> = {}): ChecklistPdfSource => {
  const snapshot: ChecklistItemsSnapshot = [{
    id: 'f1',
    title: 'Encuesta al conductor',
    sort_order: 1,
    answer_type: 'si_no_na',
    items: Array.from({ length: 6 }, (_, index) => ({
      id: `f1-${index}`,
      label: `Pregunta ${index + 1}`,
      sort_order: index + 1,
      risk_answer: null,
      answer_type: 'si_no_na' as const,
    })),
  }];

  return {
    id: '22222222-2222-2222-2222-222222222222',
    template_id: 'fatiga_somnolencia',
    template_version: 1,
    template_answer_type: 'si_no_na',
    template_name: 'Lista de Chequeo de Fatiga y Somnolencia a Conductores y Operadores',
    items_snapshot: snapshot,
    answers: Object.fromEntries(snapshot[0].items.map((item, i) => [item.id, i === 0 ? 'no' : 'si'])),
    header: { faena: 'Candelaria', hora: '06:40' },
    observations: null,
    is_safe_to_operate: null,
    operator_signature: null,
    reviewer_name: null,
    reviewer_signature: null,
    performed_at: '2026-08-03T06:40:00-04:00',
    performed_date: '2026-08-03',
    ...overrides,
  };
};

/**
 * Texto REALMENTE dibujado en el PDF.
 *
 * jsPDF no comprime por defecto, así que las cadenas quedan en el stream de
 * contenido como literales `(...)`. Hay que desescaparlas: los paréntesis van
 * como `\(` `\)` —por eso "BUENO (B)" no se encuentra buscando en el stream
 * crudo— y los acentos como octales WinAnsi (`\363` = ó).
 *
 * Esto verifica lo que se dibujó, no lo que el plan dijo que iba a dibujar.
 */
const pdfText = (doc: { output: (kind: string) => string }): string => {
  const raw = atob(doc.output('datauristring').split(',')[1]);
  const literals = raw.match(/\((?:\\[\s\S]|[^\\()])*\)/g) ?? [];

  return literals
    .map((literal) => literal
      .slice(1, -1)
      .replace(/\\([0-7]{1,3})/g, (_m, octal: string) => String.fromCharCode(parseInt(octal, 8)))
      .replace(/\\([()\\])/g, '$1'))
    .join('\n');
};

describe('plan del PDF de checklist', () => {
  it('columnas por answer_type, con NO VIGENTE completo', () => {
    expect(getPdfColumns('vigente_no_na')).toMatchObject({
      positive: 'VIGENTE',
      negative: 'NO VIGENTE',
      na: 'N/A',
    });
    expect(getPdfColumns('bueno_malo_na')).toMatchObject({
      positive: 'BUENO (B)',
      negative: 'MALO (M)',
      na: 'NO APLICA (N/A)',
    });
    expect(getPdfColumns('si_no_na')).toMatchObject({
      positive: 'SI',
      negative: 'NO',
      na: 'N/A',
    });
  });

  it('MIXTO: la sección 1 lleva columnas de vigencia y la 4 de estado físico', () => {
    const plan = buildChecklistPdfPlan(preopChecklist(), CONTEXT);

    expect(plan.sections[0].title).toBe('DOCUMENTACIÓN DEL VEHÍCULO');
    expect(plan.sections[0].answerType).toBe('vigente_no_na');
    expect(plan.sections[0].columns.negative).toBe('NO VIGENTE');

    expect(plan.sections[3].title).toBe('ESTADO DEL VEHÍCULO Y CABINA');
    expect(plan.sections[3].answerType).toBe('bueno_malo_na');
    expect(plan.sections[3].columns.positive).toBe('BUENO (B)');
    expect(plan.sections[3].columns.negative).toBe('MALO (M)');
  });

  it('marca la columna que corresponde a cada respuesta', () => {
    const plan = buildChecklistPdfPlan(preopChecklist(), CONTEXT);
    // Sección documental: el SOAP quedó 'no_vigente' -> segunda columna.
    expect(plan.sections[0].rows[2].label).toContain('SOAP');
    expect(plan.sections[0].rows[2].markedColumn).toBe(1);
    expect(plan.sections[0].rows[0].markedColumn).toBe(0);
    // Sección física: el primero quedó 'malo' -> segunda columna.
    expect(plan.sections[3].rows[0].markedColumn).toBe(1);
    expect(plan.sections[3].rows[1].markedColumn).toBe(0);
  });

  it('un ítem sin responder no marca ninguna columna', () => {
    const checklist = preopChecklist({ answers: {} });
    const plan = buildChecklistPdfPlan(checklist, CONTEXT);
    expect(plan.sections[0].rows.every((row) => row.markedColumn === -1)).toBe(true);
  });

  it('32 ítems en 6 secciones; el de fatiga trae 6', () => {
    const preop = buildChecklistPdfPlan(preopChecklist(), CONTEXT);
    expect(preop.sections).toHaveLength(6);
    expect(preop.totalItems).toBe(32);

    const fatiga = buildChecklistPdfPlan(fatigaChecklist(), CONTEXT);
    expect(fatiga.totalItems).toBe(6);
  });

  it('antecedentes con .trim() y RUT normalizado', () => {
    const plan = buildChecklistPdfPlan(preopChecklist(), CONTEXT);
    const map = Object.fromEntries(plan.antecedents);
    expect(map['Patente']).toBe('TDCJ-46');
    expect(map['RUT operador']).toBe('12.345.678-5');
    expect(map['Folio del servicio']).toBe('SRV-7001');
  });

  it('sin folio de servicio el antecedente no aparece (el checklist es independiente)', () => {
    const plan = buildChecklistPdfPlan(preopChecklist(), { ...CONTEXT, serviceFolio: null });
    expect(plan.antecedents.some(([label]) => label === 'Folio del servicio')).toBe(false);
  });

  it('pregunta de cierre solo en el pre-operacional, con SI/NO desde is_safe_to_operate', () => {
    expect(buildChecklistPdfPlan(preopChecklist(), CONTEXT).closingQuestion).toEqual({
      text: PREOP_CLOSING_QUESTION,
      answer: 'SI',
    });
    expect(buildChecklistPdfPlan(preopChecklist({ is_safe_to_operate: false }), CONTEXT).closingQuestion?.answer)
      .toBe('NO');
    expect(buildChecklistPdfPlan(preopChecklist({ is_safe_to_operate: null }), CONTEXT).closingQuestion?.answer)
      .toBeNull();
    expect(buildChecklistPdfPlan(fatigaChecklist(), CONTEXT).closingQuestion).toBeNull();
  });

  it('la nota literal va solo en el de fatiga', () => {
    expect(buildChecklistPdfPlan(fatigaChecklist(), CONTEXT).footerNote).toBe(FATIGA_FOOTER_NOTE);
    expect(buildChecklistPdfPlan(preopChecklist(), CONTEXT).footerNote).toBeNull();
  });

  it('sin revisor solo se planifica el bloque del operador', () => {
    const plan = buildChecklistPdfPlan(preopChecklist(), CONTEXT);
    expect(plan.signatures).toHaveLength(1);
    expect(plan.signatures[0].label).toBe('Firma del Operador');
    expect(plan.signatures[0].rut).toBe('12345678-5');
  });

  it('con revisor se agregan dos bloques', () => {
    const plan = buildChecklistPdfPlan(
      preopChecklist({ reviewer_name: 'Ana Soto', reviewer_signature: 'data:image/png;base64,x' }),
      CONTEXT,
    );
    expect(plan.signatures).toHaveLength(2);
    expect(plan.signatures[1].name).toBe('Ana Soto');
  });

  it('documento antiguo sin answer_type en el snapshot cae a la plantilla sin excepción', () => {
    // Snapshot de la v1: ni la sección ni los ítems traen answer_type.
    const legacy: ChecklistItemsSnapshot = [{
      id: 'old',
      title: 'DOCUMENTACIÓN DEL VEHÍCULO',
      sort_order: 1,
      items: [
        { id: 'o1', label: 'Permiso de Circulación al día', sort_order: 1, risk_answer: null },
        { id: 'o2', label: 'Seguro Obligatorio (SOAP) vigente', sort_order: 2, risk_answer: null },
      ],
    }];

    const plan = buildChecklistPdfPlan(
      preopChecklist({
        items_snapshot: legacy,
        template_version: 1,
        answers: { o1: 'bueno', o2: 'malo' },
      }),
      CONTEXT,
    );

    expect(plan.sections[0].answerType).toBe('bueno_malo_na');
    expect(plan.sections[0].columns.positive).toBe('BUENO (B)');
    expect(plan.sections[0].rows[1].markedColumn).toBe(1);
  });

  it('una sección sin ítems no rompe la resolución del tipo', () => {
    const vacia: ChecklistItemsSnapshot = [{
      id: 'v', title: 'Vacía', sort_order: 1, answer_type: 'vigente_no_na', items: [],
    }];
    const plan = buildChecklistPdfPlan(preopChecklist({ items_snapshot: vacia }), CONTEXT);
    expect(plan.sections[0].answerType).toBe('vigente_no_na');
    expect(plan.totalItems).toBe(0);
  });
});

describe('PDF realmente dibujado', () => {
  let preopText: string;
  let preopPages: number;
  let fatigaText: string;

  beforeAll(async () => {
    const preop = await buildChecklistPdfDocument({
      checklist: preopChecklist(),
      context: CONTEXT,
      companyData: COMPANY,
    });
    preopText = pdfText(preop.doc);
    preopPages = preop.doc.getNumberOfPages();

    const fatiga = await buildChecklistPdfDocument({
      checklist: fatigaChecklist(),
      context: CONTEXT,
      companyData: COMPANY,
    });
    fatigaText = pdfText(fatiga.doc);
  });

  it('el pre-operacional entra en más de una página y dibuja sus 32 filas', () => {
    expect(preopPages).toBeGreaterThanOrEqual(2);
    // Cada fila lleva su correlativo; se verifica con las etiquetas, que son únicas.
    const labels = preopSnapshot().flatMap((s) => s.items.map((i) => i.label));
    expect(labels).toHaveLength(32);
    labels.forEach((label) => {
      expect(preopText.includes(label)).toBe(true);
    });
  });

  it('MIXTO en el papel: ambos juegos de cabeceras conviven en el mismo PDF', () => {
    expect(preopText).toContain('VIGENTE');
    expect(preopText).toContain('NO VIGENTE');
    expect(preopText).toContain('BUENO (B)');
    expect(preopText).toContain('MALO (M)');
    expect(preopText).toContain('NO APLICA (N/A)');
  });

  it('ninguna cabecera de respuesta envuelve a dos líneas', () => {
    // Al envolverse, autoTable dibuja cada línea como una cadena aparte: la
    // etiqueta completa dejaría de aparecer entera. Que se encuentre tal cual,
    // sin normalizar los saltos, prueba que entra en una sola línea.
    ['VIGENTE', 'NO VIGENTE', 'BUENO (B)', 'MALO (M)', 'NO APLICA (N/A)'].forEach((label) => {
      expect(preopText.split('\n')).toContain(label);
    });
  });

  it('NO se dibuja columna de observaciones por ítem', () => {
    // Se dibujaba vacía y ante un revisor de faena se leía como formulario
    // incompleto. La cabecera de columna ya no existe...
    expect(preopText.split('\n')).not.toContain('OBSERVACIONES');
    // ...pero el bloque de observaciones generales sigue en su lugar.
    expect(preopText).toContain('OBSERVACIONES GENERALES');
    expect(preopText).toContain('filtraci');
  });

  it('"NO VIGENTE" se imprime completo, sin truncar ni abreviar', () => {
    expect(preopText).toContain('NO VIGENTE');
    // No aparece una versión recortada como "NO VIGE..." o "NO VIG".
    expect(preopText).not.toMatch(/NO VIGE\.\.\./);
    expect(preopText).not.toMatch(/NO VIG[^E]/);
  });

  it('las secciones, la identidad de la empresa y el pie quedan en el documento', () => {
    expect(preopText).toContain('DOCUMENTACIÓN DEL VEHÍCULO');
    expect(preopText).toContain('ELEMENTOS DE SEGURIDAD Y EMERGENCIA');
    expect(preopText).toContain('76.769.841-0');
    expect(preopText).toContain('Panamericana Norte Km. 841, Copiapó');
    expect(preopText).toMatch(/Página 1 de \d+/);
    // Antecedentes: patente con .trim() y RUT normalizado.
    expect(preopText).toContain('TDCJ-46');
    expect(preopText).toContain('12.345.678-5');
    expect(preopText).toContain('SRV-7001');
  });

  it('la pregunta de cierre se dibuja con sus dos opciones', () => {
    expect(preopText).toContain(PREOP_CLOSING_QUESTION);
    expect(preopText).toContain('SI');
    expect(preopText).toContain('NO');
  });

  it('is_safe_to_operate=false dibuja la pregunta y una sola marca de cierre', async () => {
    const { doc, plan } = await buildChecklistPdfDocument({
      checklist: preopChecklist({ is_safe_to_operate: false }),
      context: CONTEXT,
      companyData: COMPANY,
    });
    const text = pdfText(doc);
    expect(text).toContain(PREOP_CLOSING_QUESTION);
    expect(plan.closingQuestion?.answer).toBe('NO');
    expect(text).not.toContain('Sin respuesta registrada');
  });

  it('sin respuesta de cierre lo dice en vez de dejar el recuadro mudo', async () => {
    const { doc } = await buildChecklistPdfDocument({
      checklist: preopChecklist({ is_safe_to_operate: null }),
      context: CONTEXT,
      companyData: COMPANY,
    });
    expect(pdfText(doc)).toContain('Sin respuesta registrada');
  });

  it('las observaciones generales se imprimen', () => {
    expect(preopText).toContain('filtraci');
    expect(preopText).toContain('OBSERVACIONES GENERALES');
  });

  it('el de fatiga lleva cabecera SI/NO/N/A y la nota literal al pie', () => {
    expect(fatigaText).toContain('SI');
    expect(fatigaText).toContain('N/A');
    // Los títulos de sección se dibujan en mayúsculas.
    expect(fatigaText).toContain('ENCUESTA AL CONDUCTOR');
    // La nota va literal; se dibuja envuelta, así que se compara sin los saltos.
    expect(fatigaText.replace(/\n/g, ' ')).toContain(FATIGA_FOOTER_NOTE);
    // Y no arrastra columnas del pre-operacional.
    expect(fatigaText).not.toContain('NO VIGENTE');
    expect(fatigaText).not.toContain('BUENO (B)');
    expect(fatigaText).not.toContain(PREOP_CLOSING_QUESTION);
  });

  it('sin revisor el layout no se desarma ni deja un recuadro sin rótulo', async () => {
    const { doc, plan } = await buildChecklistPdfDocument({
      checklist: preopChecklist(),
      context: CONTEXT,
      companyData: COMPANY,
    });
    const text = pdfText(doc);
    expect(plan.signatures).toHaveLength(1);
    expect(text).toContain('FIRMA DEL OPERADOR');
    expect(text).not.toContain('REVISOR / SUPERVISOR');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('con revisor aparecen los dos rótulos', async () => {
    const { doc } = await buildChecklistPdfDocument({
      checklist: preopChecklist({ reviewer_name: 'Ana Soto', reviewer_signature: undefined as never }),
      context: CONTEXT,
      companyData: COMPANY,
    });
    const text = pdfText(doc);
    expect(text).toContain('FIRMA DEL OPERADOR');
    expect(text).toContain('REVISOR / SUPERVISOR');
  });

  it('un snapshot antiguo genera PDF sin lanzar', async () => {
    const legacy: ChecklistItemsSnapshot = [{
      id: 'old', title: 'DOCUMENTACION', sort_order: 1,
      items: [{ id: 'o1', label: 'Permiso', sort_order: 1, risk_answer: null }],
    }];
    await expect(buildChecklistPdfDocument({
      checklist: preopChecklist({ items_snapshot: legacy, template_version: 1, answers: { o1: 'bueno' } }),
      context: CONTEXT,
      companyData: COMPANY,
    })).resolves.toBeTruthy();
  });
});
