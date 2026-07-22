import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from '@/utils/imageCompression';

const installCanvasMock = () => {
  const realCreateElement = document.createElement.bind(document);
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage,
    })),
    toBlob: vi.fn((callback: BlobCallback, type?: string) => {
      callback(new Blob(['compressed'], { type: type || 'image/jpeg' }));
    }),
  };
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
    if (tagName === 'canvas') return canvas as unknown as HTMLCanvasElement;
    return realCreateElement(tagName);
  }) as typeof document.createElement);
  return { canvas, drawImage };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('imageCompression', () => {
  it('reduce la captura y libera el ImageBitmap', async () => {
    const { drawImage } = installCanvasMock();
    const close = vi.fn();
    const bitmap = { width: 2400, height: 1200, close } as unknown as ImageBitmap;
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));

    const result = await compressImage(new Blob(['photo'], { type: 'image/jpeg' }));

    expect(result.type).toBe('image/jpeg');
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 800);
    expect(close).toHaveBeenCalledOnce();
  });

  it('usa el decodificador de Safari cuando createImageBitmap rechaza la foto', async () => {
    const { drawImage } = installCanvasMock();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:iphone-photo'),
      revokeObjectURL,
    });
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('HEIC no soportado')));

    class SafariImageMock {
      decoding = '';
      naturalWidth = 1200;
      naturalHeight = 900;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private value = '';

      set src(value: string) {
        this.value = value;
        if (value) queueMicrotask(() => this.onload?.());
      }

      get src() {
        return this.value;
      }
    }
    vi.stubGlobal('Image', SafariImageMock);

    const result = await compressImage(new Blob(['photo'], { type: 'image/heic' }));

    expect(result.size).toBeGreaterThan(0);
    expect(drawImage).toHaveBeenCalledWith(expect.any(SafariImageMock), 0, 0, 1200, 900);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:iphone-photo');
  });
});
