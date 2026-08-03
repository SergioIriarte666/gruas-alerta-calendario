/**
 * El membrete del PDF de checklist.
 *
 * POR QUÉ EXISTE ESTE TEST: el PDF de prueba que se revisó a mano salió sin
 * logo, y no era un defecto del generador — se había producido desde vitest, y
 * `addPDFHeader` depende de dos APIs del navegador que jsdom no implementa:
 * `fetch` sobre la URL del logo y `new Image()` para medirlo. Cuando cualquiera
 * de las dos falla, el helper cae en su `catch { /* sin logo *\/ }` y dibuja el
 * documento sin membrete, en silencio.
 *
 * Acá se emulan esas dos APIs para ejercitar el camino que sí corre en el
 * teléfono del operador, y se comprueba que el PDF termina con una imagen
 * embebida de verdad.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildChecklistPdfDocument } from '@/utils/pdf/checklistPdfGenerator';
import type { ChecklistPdfSource } from '@/utils/pdf/checklistPdfPlan';
import type { CompanyData } from '@/utils/pdf/companyDataFetcher';

const LOGO_URL = 'https://ejemplo.test/logo.png';

const COMPANY: CompanyData = {
  businessName: 'Grúas 5 Norte SpA',
  rut: '76.769.841-0',
  address: 'Panamericana Norte Km. 841, Copiapó',
  phone: '+56 52 2353533',
  email: 'asistencia@gruas5norte.cl',
  logoUrl: LOGO_URL,
};

const checklist: ChecklistPdfSource = {
  id: '55555555-5555-5555-5555-555555555555',
  template_id: 'preoperacional_grua_cama',
  template_version: 2,
  template_answer_type: 'bueno_malo_na',
  template_name: 'Checklist Pre-Operacional: Camión Grúa Cama (Chile)',
  items_snapshot: [{
    id: 's1', title: 'DOCUMENTACIÓN DEL VEHÍCULO', sort_order: 1, answer_type: 'vigente_no_na',
    items: [{ id: 'i1', label: 'Permiso de Circulación al día', sort_order: 1, risk_answer: null, answer_type: 'vigente_no_na' }],
  }],
  answers: { i1: 'vigente' },
  header: { patente: 'DSBZ-85' },
  observations: null,
  is_safe_to_operate: true,
  operator_signature: null,
  reviewer_name: null,
  reviewer_signature: null,
  performed_at: '2026-08-04T08:00:00-04:00',
  performed_date: '2026-08-04',
};

const CONTEXT = { operatorName: 'Operador', operatorRut: '12345678-5' };

/** ¿El PDF trae al menos un objeto de imagen embebido? */
const hasEmbeddedImage = (doc: { output: (kind: string) => string }): boolean => {
  const raw = atob(doc.output('datauristring').split(',')[1]);
  return /\/Subtype\s*\/Image/.test(raw);
};

describe('membrete del PDF de checklist', () => {
  const originalFetch = globalThis.fetch;
  const originalImage = globalThis.Image;

  beforeAll(() => {
    const logoBytes = readFileSync(resolve(process.cwd(), 'public/logo-gruas-5-norte.png'));

    // jsdom no descarga imágenes: se emula la respuesta del logo.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('logo')) throw new Error(`fetch inesperado: ${url}`);
      // Se devuelve un objeto mínimo con blob() en vez de un Response de
      // undici: FileReader de jsdom no sabe leer un Blob de undici y
      // loadImageAsBase64 terminaba devolviendo null, que es exactamente el
      // camino "sin membrete" que este test quiere distinguir.
      return {
        ok: true,
        blob: async () => new Blob([new Uint8Array(logoBytes)], { type: 'image/png' }),
      } as unknown as Response;
    }) as typeof fetch;

    // ...ni las decodifica: `new Image()` nunca dispara onload en jsdom, así que
    // se emula para que getImageDimensions pueda resolver.
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 512;
      height = 512;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  it('dibuja el logo de la ficha de la empresa', async () => {
    const { doc } = await buildChecklistPdfDocument({ checklist, context: CONTEXT, companyData: COMPANY });

    expect(globalThis.fetch).toHaveBeenCalledWith(LOGO_URL);
    expect(hasEmbeddedImage(doc)).toBe(true);
  });

  it('sin logo cargable el PDF se genera igual, solo que sin membrete', async () => {
    // Es el escenario real de un operador sin señal en faena: el documento de
    // seguridad tiene que salir igual, no quedarse sin generar.
    const failing = vi.fn(async () => { throw new Error('sin red'); }) as unknown as typeof fetch;
    const previous = globalThis.fetch;
    globalThis.fetch = failing;

    try {
      const { doc } = await buildChecklistPdfDocument({ checklist, context: CONTEXT, companyData: COMPANY });
      expect(hasEmbeddedImage(doc)).toBe(false);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    } finally {
      globalThis.fetch = previous;
    }
  });
});
