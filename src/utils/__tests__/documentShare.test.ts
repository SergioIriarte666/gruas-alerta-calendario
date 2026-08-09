import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadDocumentFromUrl,
  shareDocument,
  type ShareableDocument,
} from '@/utils/documentShare';

const document: ShareableDocument = {
  bucket: 'inspection-pdfs',
  path: 'service/form.pdf',
  title: 'Inspección inicial · 1234',
  fileName: 'inspeccion-inicial-1234.pdf',
};

const pdfResponse = () => new Response('pdf', {
  status: 200,
  headers: { 'content-type': 'application/pdf' },
});

describe('entrega de documentos al usuario', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse()));
  });

  it('comparte el PDF real cuando el dispositivo acepta archivos', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    await expect(shareDocument(document, 'https://r2/signed')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledOnce();
    const payload = share.mock.calls[0][0] as ShareData;
    expect(payload.files?.[0].name).toBe('inspeccion-inicial-1234.pdf');
    expect(payload.files?.[0].type).toBe('application/pdf');
  });

  it('descarga con un nombre legible', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.fn().mockReturnValue('blob:inspection');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    await expect(downloadDocumentFromUrl('https://r2/signed', document)).resolves.toBe('downloaded');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });
});
