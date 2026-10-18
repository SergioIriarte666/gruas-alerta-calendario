import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReceiptSignedUrls, migratePurchaseReceiptPhotos } from '../receiptPhotos';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), sign: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke }, storage: { from: () => ({ createSignedUrls: mocks.sign }) } } }));
const path = '00000000-0000-0000-0000-000000000001/manual-purchases/00000000-0000-0000-0000-000000000002.jpg';
beforeEach(() => vi.clearAllMocks());
describe('Respaldos privados de compras en R2', () => {
  it('resuelve manuales por el servicio autenticado y preserva otros flujos de fotos', async () => {
    mocks.invoke.mockResolvedValue({ data: { data: [{ path, signedUrl: 'https://r2.example/signed' }] }, error: null });
    mocks.sign.mockResolvedValue({ data: [{ path: 'user/quick-photo.jpg', signedUrl: 'https://supabase.example/signed' }], error: null });
    const result = await createReceiptSignedUrls(['user/quick-photo.jpg', path]);
    expect(result.data.map(photo => photo.signedUrl)).toEqual(['https://supabase.example/signed', 'https://r2.example/signed']);
    expect(mocks.invoke).toHaveBeenCalledWith('purchase-receipts', { body: { action: 'urls', paths: [path] } });
    expect(mocks.sign).toHaveBeenCalledWith(['user/quick-photo.jpg'], 600);
  });
  it('no busca en Supabase ni convierte en público un respaldo R2 rechazado', async () => {
    mocks.invoke.mockResolvedValue({ error: new Error('No autorizado') });
    const result = await createReceiptSignedUrls([path]);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toEqual([]);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('no oculta un respaldo ausente en una respuesta parcial', async () => {
    mocks.invoke.mockResolvedValue({ data: { data: [] } });
    const result = await createReceiptSignedUrls([path]);
    expect(result.data[0]).toMatchObject({ path, signedUrl: '', error: 'Respaldo no disponible' });
  });
  it('traslada en lotes y propaga errores sin afirmar que se borró el original', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { results: [{ path, migrated: true }], nextCursor: null } });
    expect((await migratePurchaseReceiptPhotos()).results[0].migrated).toBe(true);
    mocks.invoke.mockResolvedValueOnce({ data: { error: 'R2 no verificado' } });
    await expect(migratePurchaseReceiptPhotos(path)).rejects.toThrow('R2 no verificado');
    expect(mocks.invoke).toHaveBeenLastCalledWith('purchase-receipts', { body: { action: 'migrate', after: path, limit: 5 } });
  });
});
