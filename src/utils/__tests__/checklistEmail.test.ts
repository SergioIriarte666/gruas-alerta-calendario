/**
 * Pruebas del correo de checklist (Fase 4).
 *
 * Apuntan al módulo compartido de la edge function, que a propósito no importa
 * Resend ni nada de Deno: así lo que corre en producción es exactamente lo que
 * se prueba acá, sin una copia paralela de la lógica.
 */
import { describe, it, expect } from 'vitest';
import {
  buildChecklistAttachmentName,
  buildChecklistEmailHtml,
  buildChecklistEmailSubject,
  CHECKLIST_LOGO_CID,
  DEFAULT_EMAIL_LOGO_URL,
  getChecklistDispatchSkipReason,
  isValidEmailAddress,
  parseRecipientList,
  UNSAFE_TO_OPERATE_HEADLINE,
  type ChecklistEmailContent,
} from '../../../supabase/functions/_shared/checklistEmailContent';

const content = (overrides: Partial<ChecklistEmailContent> = {}): ChecklistEmailContent => ({
  templateId: 'preoperacional_grua_cama',
  templateName: 'Checklist Pre-Operacional: Camión Grúa Cama (Chile)',
  operatorName: 'Juan Carlos Pérez',
  operatorRut: '12.345.678-5',
  licensePlate: '  TDCJ-46  ',
  faena: 'Los Pelambres',
  areaEmpresa: 'Operaciones',
  performedDate: '2026-08-04',
  performedTime: '07:15',
  isSafeToOperate: true,
  ...overrides,
});

describe('destinatarios desde daily_report_emails', () => {
  it('descarta la basura y conserva los válidos', () => {
    // daily_report_emails es TEXT, no un arreglo: puede traer varias casillas
    // separadas por coma y, con el tiempo, cosas tecleadas a mano.
    expect(parseRecipientList('a@x.cl, basura, b@y.cl')).toEqual(['a@x.cl', 'b@y.cl']);
  });

  it('normaliza espacios y mayúsculas, y deduplica', () => {
    expect(parseRecipientList('  Asistencia@Gruas5Norte.CL , asistencia@gruas5norte.cl '))
      .toEqual(['asistencia@gruas5norte.cl']);
  });

  it('el valor real de producción se resuelve a una casilla', () => {
    expect(parseRecipientList('asistencia@gruas5norte.cl')).toEqual(['asistencia@gruas5norte.cl']);
  });

  it('vacío, NULL o solo basura devuelven lista vacía', () => {
    expect(parseRecipientList(null)).toEqual([]);
    expect(parseRecipientList('')).toEqual([]);
    expect(parseRecipientList('  ,  , sin-arroba')).toEqual([]);
  });

  it('un destinatario malo no arrastra a los buenos', () => {
    // Un dominio mal tecleado no puede dejar sin correo a quien sí está bien.
    expect(parseRecipientList('roto@, ok@gruas5norte.cl')).toEqual(['ok@gruas5norte.cl']);
  });

  it('rechaza direcciones absurdamente largas', () => {
    expect(isValidEmailAddress(`${'a'.repeat(250)}@x.cl`)).toBe(false);
  });
});

describe('cuándo NO corresponde despachar', () => {
  it('sin PDF -> skipped, no es un error', () => {
    // El PDF pudo fallar después de la firma; se reintenta desde la UI. Lanzar
    // consumiría reintentos del outbox para nada.
    expect(getChecklistDispatchSkipReason({ pdfUrl: null, recipients: ['a@x.cl'] }))
      .toBe('checklist_pdf_missing');
    expect(getChecklistDispatchSkipReason({ pdfUrl: '', recipients: ['a@x.cl'] }))
      .toBe('checklist_pdf_missing');
  });

  it('sin destinatarios -> skipped', () => {
    expect(getChecklistDispatchSkipReason({ pdfUrl: 'x/y.pdf', recipients: [] }))
      .toBe('no_recipient');
  });

  it('con PDF y destinatario -> se despacha', () => {
    expect(getChecklistDispatchSkipReason({ pdfUrl: 'x/y.pdf', recipients: ['a@x.cl'] }))
      .toBeNull();
  });

  it('la falta de PDF manda sobre la falta de destinatario', () => {
    expect(getChecklistDispatchSkipReason({ pdfUrl: null, recipients: [] }))
      .toBe('checklist_pdf_missing');
  });
});

describe('contenido del correo', () => {
  it('is_safe_to_operate=false destaca el NO APTO', () => {
    const html = buildChecklistEmailHtml(content({ isSafeToOperate: false }));
    expect(html).toContain(UNSAFE_TO_OPERATE_HEADLINE);
    expect(html).toContain('NO se encuentra en condiciones seguras');
  });

  it('con el equipo apto NO aparece la advertencia', () => {
    expect(buildChecklistEmailHtml(content({ isSafeToOperate: true })))
      .not.toContain(UNSAFE_TO_OPERATE_HEADLINE);
  });

  it('el de fatiga (is_safe_to_operate null) tampoco la muestra', () => {
    expect(buildChecklistEmailHtml(content({ templateId: 'fatiga_somnolencia', isSafeToOperate: null })))
      .not.toContain(UNSAFE_TO_OPERATE_HEADLINE);
  });

  it('el cuerpo trae los antecedentes pedidos', () => {
    const html = buildChecklistEmailHtml(content());
    expect(html).toContain('Juan Carlos Pérez');
    expect(html).toContain('12.345.678-5');
    expect(html).toContain('TDCJ-46');
    expect(html).toContain('Los Pelambres');
    expect(html).toContain('Operaciones');
    expect(html).toContain('2026-08-04');
    expect(html).toContain('07:15');
  });

  it('lleva el membrete, el mismo archivo que los informes PDF', () => {
    const html = buildChecklistEmailHtml(content());
    expect(html).toContain(DEFAULT_EMAIL_LOGO_URL);
    expect(html).toContain('alt="Grúas 5 Norte"');
    // width/height como atributos: Outlook ignora el CSS y sin ellos el logo
    // sale a tamaño original.
    expect(html).toContain('width="96"');
  });

  it('con el logo adjunto inline el <img> apunta a cid:, no a una URL remota', () => {
    // Es el arreglo del "llegó sin logotipo": la mayoría de los clientes bloquea
    // imágenes externas, y una imagen inline no depende de ese permiso.
    const html = buildChecklistEmailHtml(content({ logoInline: true }));
    expect(html).toContain(`src="cid:${CHECKLIST_LOGO_CID}"`);
    expect(html).not.toContain('https://');
  });

  it('sin logo inline se cae a la URL remota, no se queda sin membrete', () => {
    const html = buildChecklistEmailHtml(content({ logoInline: false }));
    expect(html).toContain(DEFAULT_EMAIL_LOGO_URL);
    expect(html).not.toContain('cid:');
  });

  it('el logo de la ficha de la empresa gana sobre el de por defecto', () => {
    const html = buildChecklistEmailHtml(content({ logoUrl: 'https://cdn.x/logo-v2.png' }));
    expect(html).toContain('https://cdn.x/logo-v2.png');
    expect(html).not.toContain(DEFAULT_EMAIL_LOGO_URL);
  });

  it('un logo vacío o en blancos cae al de por defecto', () => {
    expect(buildChecklistEmailHtml(content({ logoUrl: '   ' }))).toContain(DEFAULT_EMAIL_LOGO_URL);
    expect(buildChecklistEmailHtml(content({ logoUrl: null }))).toContain(DEFAULT_EMAIL_LOGO_URL);
  });

  it('los campos ausentes no dejan filas vacías', () => {
    const html = buildChecklistEmailHtml(content({ faena: null, areaEmpresa: null, performedTime: null }));
    expect(html).not.toContain('<strong>Faena:</strong>');
    expect(html).not.toContain('<strong>Área / Empresa:</strong>');
    expect(html).not.toContain('<strong>Hora:</strong>');
    // El operador y la fecha van siempre.
    expect(html).toContain('<strong>Operador:</strong>');
    expect(html).toContain('<strong>Fecha:</strong>');
  });

  it('asunto y adjunto llevan patente sin espacios y fecha', () => {
    expect(buildChecklistEmailSubject(content()))
      .toBe('[Checklist] Checklist Pre-Operacional: Camión Grúa Cama (Chile) - TDCJ-46 - 2026-08-04');
    expect(buildChecklistAttachmentName(content())).toBe('Preoperacional-TDCJ-46-2026-08-04.pdf');
    expect(buildChecklistAttachmentName(content({ templateId: 'fatiga_somnolencia' })))
      .toBe('Fatiga-TDCJ-46-2026-08-04.pdf');
  });

  it('sin patente el nombre del adjunto sigue siendo válido', () => {
    expect(buildChecklistAttachmentName(content({ licensePlate: null })))
      .toBe('Preoperacional-sin-patente-2026-08-04.pdf');
  });
});
