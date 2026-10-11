import { describe, it, expect } from 'vitest';
import {
  collectProjectTags,
  getDocumentProjectTag,
  groupDocumentsIntoFolders,
  UNGROUPED_KEY,
} from '../businessDocuments';
import type { BusinessDocument } from '@/hooks/useBusinessDocuments';

let counter = 0;
const doc = (overrides: Partial<BusinessDocument>): BusinessDocument => ({
  id: `doc-${++counter}`,
  title: `Documento ${counter}`,
  description: null,
  category: 'otros',
  tags: [],
  file_name: 'a.pdf',
  file_path: 'x/a.pdf',
  file_type: 'application/pdf',
  file_size: 10,
  related_entity_type: null,
  related_entity_id: null,
  document_date: null,
  expires_at: null,
  is_confidential: false,
  uploaded_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  ...overrides,
} as BusinessDocument);

const expiryByDate = (expiresAt: string | null) => {
  if (!expiresAt) return 'none' as const;
  if (expiresAt < '2026-10-11') return 'expired' as const;
  if (expiresAt <= '2026-11-10') return 'soon' as const;
  return 'valid' as const;
};

describe('groupDocumentsIntoFolders', () => {
  it('no pierde ningún documento y manda los sin entidad a "Sin relación" al final', () => {
    const docs = [
      doc({ category: 'documentos_vehiculos', related_entity_type: 'crane' }),
      doc({ category: 'documentos_vehiculos', related_entity_type: null }),
      doc({ category: 'documentos_vehiculos', related_entity_type: 'cost', related_entity_id: '6018b9bc-5968-473e-b84e-2db435f6bfe8' }),
      doc({ category: 'contratos' }),
    ];
    const sections = groupDocumentsIntoFolders(docs, expiryByDate);

    const placed = sections.flatMap((s) => s.groups.flatMap((g) => g.documents.map((d) => d.id)));
    expect(placed.sort()).toEqual(docs.map((d) => d.id).sort());

    const vehicles = sections.find((s) => s.category === 'documentos_vehiculos')!;
    expect(vehicles.total).toBe(3);
    expect(vehicles.groupBy).toBe('entity');
    expect(vehicles.groups.map((g) => g.label)).toEqual(['Costo · 6018b9bc', 'Grúa', 'Sin relación']);
    expect(vehicles.groups.at(-1)!.key).toBe(UNGROUPED_KEY);
  });

  it('ordena las secciones según DOCUMENT_CATEGORIES y las categorías desconocidas al final', () => {
    const sections = groupDocumentsIntoFolders([
      doc({ category: 'otros' }),
      doc({ category: 'zzz_legacy' }),
      doc({ category: 'contratos' }),
      doc({ category: 'importaciones', tags: ['fontaine-pxkz26'] }),
    ], expiryByDate);
    expect(sections.map((s) => s.category)).toEqual(['contratos', 'importaciones', 'otros', 'zzz_legacy']);
    expect(sections.at(-1)!.label).toBe('zzz_legacy');
  });

  it('en Importaciones agrupa por el primer tag (proyecto) y "Sin proyecto" al final', () => {
    const sections = groupDocumentsIntoFolders([
      doc({ category: 'importaciones', tags: [] }),
      doc({ category: 'importaciones', tags: ['landoll-0001', 'bl'] }),
      doc({ category: 'importaciones', tags: ['Fontaine-PXKZ26 ', 'din'] }),
      doc({ category: 'importaciones', tags: ['fontaine-pxkz26', 'factura'] }),
    ], expiryByDate);
    const imports = sections[0];
    expect(imports.groupBy).toBe('project');
    expect(imports.groups.map((g) => [g.label, g.documents.length])).toEqual([
      ['fontaine-pxkz26', 2],
      ['landoll-0001', 1],
      ['Sin proyecto', 1],
    ]);
  });

  it('cuenta vencidos y por vencer por sección con el mismo criterio que el header', () => {
    const docs = [
      doc({ category: 'documentos_vehiculos', expires_at: '2026-07-25' }),
      doc({ category: 'documentos_vehiculos', expires_at: '2026-12-20' }),
      doc({ category: 'documentos_vehiculos', expires_at: '2026-10-20', is_confidential: true }),
      doc({ category: 'contratos', expires_at: '2025-01-01' }),
    ];
    const sections = groupDocumentsIntoFolders(docs, expiryByDate);
    const totalExpired = sections.reduce((sum, s) => sum + s.expired, 0);
    expect(totalExpired).toBe(docs.filter((d) => expiryByDate(d.expires_at) === 'expired').length);

    const vehicles = sections.find((s) => s.category === 'documentos_vehiculos')!;
    expect(vehicles).toMatchObject({ expired: 1, soon: 1, confidential: 1, total: 3 });
  });

  it('conserva el orden de entrada dentro de cada grupo', () => {
    const a = doc({ category: 'contratos', related_entity_type: 'client' });
    const b = doc({ category: 'contratos', related_entity_type: 'client' });
    const sections = groupDocumentsIntoFolders([a, b], expiryByDate);
    expect(sections[0].groups[0].documents.map((d) => d.id)).toEqual([a.id, b.id]);
  });
});

describe('tags de proyecto', () => {
  it('getDocumentProjectTag normaliza y salta tags vacíos', () => {
    expect(getDocumentProjectTag({ tags: ['  ', ' Fontaine-PXKZ26 '] })).toBe('fontaine-pxkz26');
    expect(getDocumentProjectTag({ tags: [] })).toBeNull();
  });

  it('collectProjectTags sólo mira Importaciones y devuelve únicos ordenados', () => {
    expect(collectProjectTags([
      { category: 'importaciones', tags: ['landoll-0001'] },
      { category: 'importaciones', tags: ['fontaine-pxkz26', 'din'] },
      { category: 'importaciones', tags: ['fontaine-pxkz26'] },
      { category: 'contratos', tags: ['escrituras'] },
    ])).toEqual(['fontaine-pxkz26', 'landoll-0001']);
  });
});
