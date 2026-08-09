import { describe, expect, it } from 'vitest';
import {
  buildServiceDocuments,
  type InspectionDocumentRow,
} from '@/hooks/useServiceDocuments';

const row = (
  overrides: Partial<InspectionDocumentRow> = {},
): InspectionDocumentRow => ({
  id: 'inspection-1',
  created_at: '2026-06-01T12:00:00Z',
  pdf_url: 'service/initial.pdf',
  pdf_retiro_url: 'service/final.pdf',
  r2_pdf_path: null,
  r2_pdf_retiro_path: null,
  storage_tier: 'hot',
  ...overrides,
});

describe('buildServiceDocuments', () => {
  it('mantiene los documentos recientes en Supabase Storage', () => {
    const documents = buildServiceDocuments([row()]);

    expect(documents).toHaveLength(2);
    expect(documents.map((document) => document.path)).toEqual([
      'service/initial.pdf',
      'service/final.pdf',
    ]);
    expect(documents.every((document) => document.storageTier === 'hot')).toBe(true);
  });

  it('lista los PDF históricos usando sus rutas R2', () => {
    const documents = buildServiceDocuments([row({
      storage_tier: 'cold',
      r2_pdf_path: 'inspections/service/pdfs/pdf/initial.pdf',
      r2_pdf_retiro_path: 'inspections/service/pdfs/pdf_retiro/final.pdf',
    })]);

    expect(documents).toMatchObject([
      {
        id: 'inspection-1:initial',
        inspectionId: 'inspection-1',
        phase: 'initial',
        storageTier: 'cold',
        path: 'inspections/service/pdfs/pdf/initial.pdf',
      },
      {
        id: 'inspection-1:final',
        inspectionId: 'inspection-1',
        phase: 'final',
        storageTier: 'cold',
        path: 'inspections/service/pdfs/pdf_retiro/final.pdf',
      },
    ]);
  });

  it('no ofrece documentos eliminados al cumplir la retención', () => {
    expect(buildServiceDocuments([row({ storage_tier: 'deleted' })])).toEqual([]);
  });
});
