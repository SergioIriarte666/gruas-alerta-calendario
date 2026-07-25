import { describe, expect, it } from 'vitest';
import { parsePhotoCaptureAt } from '@/utils/pdf/photos/photoTimestamp';
import { formatShortAddress } from '@/utils/addressFormat';
import { normalizePersonName, normalizePersonNameOrNull } from '@/utils/personName';
import { resolveEquipmentChecklist } from '@/utils/pdf/sections/equipmentChecklist';
import { buildEquipmentStatus } from '@/services/inspectionEquipmentCatalog';
import type { EquipmentItem } from '@/services/inspectionEquipmentCatalog';

const item = (id: string, sortOrder: number, isActive = true): EquipmentItem => ({
  id,
  name: id.replace(/-/g, ' '),
  is_active: isActive,
  sort_order: sortOrder,
});

describe('parsePhotoCaptureAt', () => {
  it('recupera la hora real de captura del nombre de archivo', () => {
    const captured = parsePhotoCaptureAt('set_fotografico_izquierdo-2026-07-25T15-44-06-04-00-x7k2n.jpg');
    expect(captured).not.toBeNull();
    expect(captured!.toISOString()).toBe('2026-07-25T19:44:06.000Z');
  });

  it('distingue fotos tomadas con segundos de diferencia', () => {
    const first = parsePhotoCaptureAt('set_fotografico_frontal-2026-07-25T15-44-06-04-00-a.jpg');
    const last = parsePhotoCaptureAt('set_fotografico_motor-2026-07-25T15-45-49-04-00-b.jpg');
    expect(last!.getTime() - first!.getTime()).toBe(103_000);
  });

  it('acepta offset Z', () => {
    expect(parsePhotoCaptureAt('foto-2026-07-25T18-00-00Z-a.jpg')!.toISOString())
      .toBe('2026-07-25T18:00:00.000Z');
  });

  it('devuelve null cuando el nombre no trae timestamp (el PDF cae al fallback)', () => {
    expect(parsePhotoCaptureAt('inicial-0')).toBeNull();
    expect(parsePhotoCaptureAt(undefined)).toBeNull();
  });
});

describe('formatShortAddress', () => {
  it('recorta código postal y país de una cadena geocodificada', () => {
    expect(formatShortAddress('Los Chercanes 95, 2571126 Viña del Mar, Valparaíso, Chile'))
      .toBe('Los Chercanes 95, Viña del Mar');
  });

  it('deja intacta una dirección corta escrita a mano', () => {
    expect(formatShortAddress('Taller 5 Norte')).toBe('Taller 5 Norte');
  });

  it('descarta componentes que son solo dígitos', () => {
    expect(formatShortAddress('Av. Copayapu 1000, 1530000, Copiapó, Chile'))
      .toBe('Av. Copayapu 1000, Copiapó');
  });

  it('no revienta con vacío', () => {
    expect(formatShortAddress(null)).toBe('');
  });
});

describe('normalizePersonName', () => {
  it('colapsa el doble espacio que quedó impreso en el acta', () => {
    expect(normalizePersonName('Rodrigo  Del Saz')).toBe('Rodrigo Del Saz');
  });

  it('devuelve null cuando queda vacío', () => {
    expect(normalizePersonNameOrNull('   ')).toBeNull();
  });
});

describe('buildEquipmentStatus', () => {
  it('marca explícitamente los ítems ausentes, no solo los presentes', () => {
    const catalog = [item('antena', 1), item('baliza', 2), item('foco-faenero', 3)];
    expect(buildEquipmentStatus(catalog, ['antena'])).toEqual({
      antena: true,
      baliza: false,
      'foco-faenero': false,
    });
  });
});

describe('resolveEquipmentChecklist', () => {
  const catalog = [item('antena', 1), item('baliza', 2), item('foco-faenero', 3)];

  it('enumera TODO el catálogo activo, incluido el ítem agregado más tarde', () => {
    const resolved = resolveEquipmentChecklist(catalog, undefined, ['antena']);
    expect(resolved.items.map((i) => i.id)).toEqual(['antena', 'baliza', 'foco-faenero']);
    expect(resolved.hasExplicitStatus).toBe(false);
  });

  it('congela el catálogo de la inspección cuando hay equipment_status', () => {
    const resolved = resolveEquipmentChecklist(
      [...catalog, item('extintor-nuevo', 4)],
      { antena: true, baliza: false, 'foco-faenero': false },
      ['antena'],
    );
    // 'extintor-nuevo' se agregó después: no debe aparecer en un acta histórica.
    expect(resolved.items.map((i) => i.id)).toEqual(['antena', 'baliza', 'foco-faenero']);
    expect(resolved.hasExplicitStatus).toBe(true);
  });

  it('conserva ítems evaluados que ya no están en el catálogo', () => {
    const resolved = resolveEquipmentChecklist(
      [item('antena', 1)],
      { antena: true, 'item-retirado': false },
      undefined,
    );
    expect(resolved.items.map((i) => i.id)).toEqual(['antena', 'item-retirado']);
  });

  it('omite los ítems desactivados cuando no hay estado explícito', () => {
    const resolved = resolveEquipmentChecklist(
      [item('antena', 1), item('obsoleto', 2, false)],
      undefined,
      ['antena'],
    );
    expect(resolved.items.map((i) => i.id)).toEqual(['antena']);
  });
});
