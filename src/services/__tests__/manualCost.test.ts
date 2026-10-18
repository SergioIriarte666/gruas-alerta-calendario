import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildManualCostPayload, registerManualCost, type ManualCostClassification } from '../manualCost';
import { draftFromReceiptExtraction, validateManualPurchase } from '@/utils/manualPurchase';
import { matchesCostSubcategory } from '@/utils/costHelpers';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/services/manualPurchase', () => ({ uploadManualPurchasePhoto: mocks.upload }));

const draft = () => draftFromReceiptExtraction({ vendorName: 'Dicar', vendorRut: '85355900-8', documentNumber: '54491', date: '2026-10-15', totals: { neto: 4000, iva: 760, total: 4760 }, items: [{ productCode: '00015-A', description: 'Herramienta', quantity: 4, unitPrice: 1000, total: 4760 }] });
const classification: ManualCostClassification = { categoryId: 'category', costCenterId: '', craneId: 'crane', entity: 'gruas_5_norte', paidBy: 'gruas_5_norte', description: 'Factura de prueba', subcategories: {}, headerSubcategoryId: '', isPaid: false, paymentDate: '2026-10-18', paymentReference: 'OP-123' };
beforeEach(() => { vi.clearAllMocks(); mocks.upload.mockResolvedValue('user/manual-purchases/request.jpg'); mocks.rpc.mockResolvedValue({ data: { cost_id: 'cost' }, error: null }); });

describe('Registro documental de costos', () => {
  it('preserva código, cantidad y precio unitario neto sin pasar parámetros de inventario', () => {
    const input = draft();
    const payload = buildManualCostPayload(input, { ...classification, subcategories: { [input.lines[0].id]: 'tools' } });
    expect(payload).toMatchObject({ supplier_rut: '85355900-8', total_amount: 4760, is_paid: false, payment_date: null, payment_reference: null, crane_id: 'crane' });
    expect(payload.lines).toEqual([expect.objectContaining({ product_code: '00015-A', quantity: 4, unit_price: 1000, subtotal: 4000, cost_subcategory_id: 'tools' })]);
    expect(payload).not.toHaveProperty('location_id');
    expect(payload.lines[0]).not.toHaveProperty('inventory_item_id');
    expect(payload.lines[0]).not.toHaveProperty('consumption_quantity');
  });
  it('permite solo cabecera en costos, pero no en bodega ni con totales incoherentes', () => {
    const input = { ...draft(), lines: [] };
    expect(validateManualPurchase(input)).toBe('Ingresa entre 1 y 100 productos.');
    expect(validateManualPurchase(input, true)).toBeNull();
    expect(buildManualCostPayload(input, { ...classification, headerSubcategoryId: 'tools' })).toMatchObject({ lines: [], header_subcategory_id: 'tools' });
    expect(() => buildManualCostPayload({ ...input, total: '9999' }, classification)).toThrow('Total no cuadra');
  });
  it('conserva la fecha y referencia de un pago explícito', () => {
    expect(buildManualCostPayload(draft(), { ...classification, isPaid: true })).toMatchObject({ payment_date: '2026-10-18', payment_reference: 'OP-123' });
  });
  it('sube el respaldo y realiza una sola operación RPC idempotente de costos', async () => {
    const photo = new File(['jpeg'], 'foto.jpg', { type: 'image/jpeg' });
    const payload = buildManualCostPayload(draft(), classification);
    await registerManualCost('request', payload, photo);
    await registerManualCost('request', payload, photo);
    expect(mocks.upload).toHaveBeenCalledWith('request', photo);
    expect(mocks.rpc).toHaveBeenCalledWith('register_manual_cost_purchase', { p_request_id: 'request', p_data: payload, p_receipt_path: 'user/manual-purchases/request.jpg' });
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
  });
  it('no escribe si falla el respaldo y propaga errores de duplicados', async () => {
    const payload = buildManualCostPayload(draft(), classification);
    mocks.upload.mockRejectedValueOnce(new Error('Respaldo no disponible'));
    await expect(registerManualCost('request', payload, null)).rejects.toThrow('Respaldo no disponible');
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ error: { message: 'La factura ya está registrada' } });
    await expect(registerManualCost('request', payload, null)).rejects.toThrow('ya está registrada');
  });
  it('encuentra costos mixtos por el detalle sin duplicar el costo completo', () => {
    const mixed = { subcategory: null, supplier_invoices: { supplier_invoice_items: [{ cost_subcategory: 'Herramientas' }, { cost_subcategory: 'Consumibles' }, { cost_subcategory: 'Herramientas' }] } };
    expect([mixed].filter(cost => matchesCostSubcategory(cost, 'Herramientas'))).toHaveLength(1);
    expect(matchesCostSubcategory(mixed, 'Consumibles')).toBe(true);
    expect(matchesCostSubcategory(mixed, 'Partes y Piezas')).toBe(false);
    expect(matchesCostSubcategory({ subcategory: 'Herramientas' }, 'Herramientas')).toBe(true);
  });
});
