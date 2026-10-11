import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchServiceSearchIds } from './useServiceSearch';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
function setup(batches: unknown[]) {
  const query = { order: vi.fn(), range: vi.fn(), abortSignal: vi.fn(), then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(batches.shift()).then(resolve, reject) };
  for (const method of ['order', 'range', 'abortSignal'] as const) query[method].mockReturnValue(query);
  mocks.rpc.mockReturnValue(query);
  return query;
}
beforeEach(() => vi.clearAllMocks());
describe('búsqueda de servicios', () => {
  it('obtiene todas las páginas y permite cancelar una consulta anterior', async () => {
    const query = setup([{ data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })), error: null }, { data: [{ id: 'last' }], error: null }]);
    const signal = new AbortController().signal;
    const ids = await fetchServiceSearchIds('camiones implementos', signal);
    expect(ids.size).toBe(1001);
    expect(ids.has('last')).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('search_service_ids', { p_search: 'camiones implementos' });
    expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(query.abortSignal).toHaveBeenCalledWith(signal);
  });
  it('rechaza resultados parciales cuando falla la segunda página', async () => {
    setup([{ data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })), error: null }, { data: null, error: { message: 'Error de conexión' } }]);
    await expect(fetchServiceSearchIds('camiones')).rejects.toThrow('Error de conexión');
  });
});
