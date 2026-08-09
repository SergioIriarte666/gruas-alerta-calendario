import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createStorageUrl: vi.fn(),
  getArchivedFiles: vi.fn(),
}));

vi.mock('@/utils/documentShare', () => ({
  createDocumentSignedUrl: mocks.createStorageUrl,
}));

vi.mock('@/utils/archivedInspectionFiles', () => ({
  getArchivedInspectionFiles: mocks.getArchivedFiles,
  archivedPdfUrlForPhase: (
    files: { tier: string; pdfUrl?: string | null; pdfRetiroUrl?: string | null },
    phase: 'initial' | 'final',
  ) => files.tier === 'cold'
    ? (phase === 'initial' ? files.pdfUrl || null : files.pdfRetiroUrl || null)
    : null,
}));

import { createServiceDocumentUrl } from '@/utils/serviceDocumentAccess';

const document = {
  bucket: 'inspection-pdfs',
  path: 'service/form.pdf',
  inspectionId: 'inspection-1',
  phase: 'initial' as const,
  storageTier: 'hot' as const,
};

describe('createServiceDocumentUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('firma en Supabase los documentos recientes', async () => {
    mocks.createStorageUrl.mockResolvedValue('https://storage/signed');

    await expect(createServiceDocumentUrl(document)).resolves.toBe('https://storage/signed');
    expect(mocks.createStorageUrl).toHaveBeenCalledWith(document);
    expect(mocks.getArchivedFiles).not.toHaveBeenCalled();
  });

  it('recupera desde R2 el PDF inicial archivado por inspectionId', async () => {
    mocks.getArchivedFiles.mockResolvedValue({
      tier: 'cold',
      pdfUrl: 'https://r2/initial-signed',
      pdfRetiroUrl: 'https://r2/final-signed',
    });

    await expect(createServiceDocumentUrl({
      ...document,
      storageTier: 'cold',
      path: 'inspections/service/initial.pdf',
    })).resolves.toBe('https://r2/initial-signed');
    expect(mocks.getArchivedFiles).toHaveBeenCalledWith({ inspectionId: 'inspection-1' });
    expect(mocks.createStorageUrl).not.toHaveBeenCalled();
  });

  it('selecciona el PDF de entrega y no devuelve archivos purgados', async () => {
    mocks.getArchivedFiles.mockResolvedValueOnce({
      tier: 'cold',
      pdfRetiroUrl: 'https://r2/final-signed',
    });
    await expect(createServiceDocumentUrl({
      ...document,
      phase: 'final',
      storageTier: 'cold',
    })).resolves.toBe('https://r2/final-signed');

    mocks.getArchivedFiles.mockResolvedValueOnce({ tier: 'deleted' });
    await expect(createServiceDocumentUrl({
      ...document,
      storageTier: 'cold',
    })).resolves.toBeNull();
  });
});
