import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractPurchasePhoto, preparePurchasePhoto, registerManualPurchase, type InventoryPurchaseArgs } from '../manualPurchase';

const mocks = vi.hoisted(() => ({ compress: vi.fn(), convert: vi.fn(), invoke: vi.fn(), upload: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }));
vi.mock('@/utils/imageCompression', () => ({ compressImage: mocks.compress }));
vi.mock('heic-to/csp', () => ({ heicTo: mocks.convert }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: mocks.invoke }, rpc: mocks.rpc, auth: { getUser: mocks.getUser }, storage: { from: () => ({ upload: mocks.upload }) },
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.compress.mockReset(); mocks.convert.mockReset();
  mocks.compress.mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: { cost_id: 'cost-1' }, error: null });
});

describe('Fotos y persistencia de compras manuales', () => {
  it('convierte HEIC en el navegador cuando el decodificador nativo no lo soporta', async () => {
    mocks.compress.mockRejectedValueOnce(new Error('Formato nativo no soportado'));
    mocks.convert.mockResolvedValue(new Blob(['decoded'], { type: 'image/jpeg' }));
    const result = await preparePurchasePhoto(new File(['heic'], 'IMG_5940.HEIC', { type: 'image/heic' }));
    expect(mocks.convert).toHaveBeenCalledOnce();
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('IMG_5940.jpg');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rechaza formatos que no son fotos', async () => {
    await expect(preparePurchasePhoto(new File(['pdf'], 'factura.pdf', { type: 'application/pdf' }))).rejects.toThrow('Usa una foto');
    expect(mocks.compress).not.toHaveBeenCalled();
  });
  it('la lectura invoca únicamente extracción, sin registrar ni subir una compra', async () => {
    mocks.invoke.mockResolvedValue({ data: { documentNumber: '54491' }, error: null });
    expect(await extractPurchasePhoto(new File(['jpeg'], 'foto.jpg', { type: 'image/jpeg' }))).toEqual({ documentNumber: '54491' });
    expect(mocks.invoke).toHaveBeenCalledWith('parse-receipt-image', { body: expect.objectContaining({ mode: 'invoice', imageMimeType: 'image/jpeg' }) });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('si falla el respaldo, no registra la compra sin su foto', async () => {
    mocks.upload.mockResolvedValueOnce({ error: { message: 'storage unavailable' } });
    await expect(registerManualPurchase('request-1', {} as InventoryPurchaseArgs, new File(['jpeg'], 'foto.jpg'))).rejects.toThrow('No se registró la compra');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('usa el mismo identificador y ruta privada en los reintentos', async () => {
    const photo = new File(['jpeg'], 'foto.jpg', { type: 'image/jpeg' });
    const args = { p_folio: '54491' } as InventoryPurchaseArgs;
    await registerManualPurchase('request-1', args, photo);
    await registerManualPurchase('request-1', args, photo);
    expect(mocks.upload).toHaveBeenCalledWith('user-1/manual-purchases/request-1.jpg', photo, expect.objectContaining({ upsert: true }));
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'register_manual_inventory_purchase', { p_request_id: 'request-1', p_data: args, p_receipt_path: 'user-1/manual-purchases/request-1.jpg' });
    expect(mocks.rpc.mock.calls[1]).toEqual(mocks.rpc.mock.calls[0]);
  });
  it('admite ingreso manual sin foto sin usar almacenamiento', async () => {
    await registerManualPurchase('request-2', {} as InventoryPurchaseArgs, null);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('register_manual_inventory_purchase', expect.objectContaining({ p_receipt_path: null }));
  });
});
