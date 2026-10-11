import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CostForm } from '../CostForm';
import type { Cost } from '@/types/costs';

const mocks = vi.hoisted(() => ({ update: vi.fn(), add: vi.fn(), error: vi.fn(), sync: vi.fn() }));
const categories = [{ id: 'inventory', name: 'Inventario' }];
vi.mock('@/hooks/useCosts', () => ({ useAddCost: () => ({ mutate: mocks.add }), useUpdateCost: () => ({ mutate: mocks.update }) }));
vi.mock('@/hooks/useCostCategories', () => ({ useCostCategories: () => ({ data: categories }) }));
vi.mock('@/hooks/useCranes', () => ({ useCranes: () => ({ cranes: [], operationalCranes: [] }) }));
vi.mock('@/hooks/operators/useOperatorsData', () => ({ useOperatorsData: () => ({ data: [] }) }));
vi.mock('@/hooks/useServices', () => ({ useServices: () => ({ services: [], getServicesForCosts: () => [] }) }));
vi.mock('@/hooks/useSuppliers', () => ({ useSuppliers: () => ({ suppliers: [] }) }));
vi.mock('@/hooks/useCostCenters', () => ({ useCostCenters: () => ({ data: [] }) }));
vi.mock('@/hooks/useQuickEntry', () => ({ useQuickEntry: () => ({ deleteEntry: vi.fn() }) }));
vi.mock('@/utils/timezoneUtils', () => ({ getCurrentChileDateString: () => '2026-10-11', formatForInput: (date: string) => date.slice(0,10) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/services/UnifiedPurchaseService', () => ({ UnifiedPurchaseService: { clearImmediateConsumptionForCost: mocks.sync, registerForExistingCost: mocks.sync, syncImportedInvoiceConsumption: mocks.sync } }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: vi.fn(), info: vi.fn() } }));
vi.mock('../ServiceExpenseModals', () => ({ ServiceExpenseModals: () => null }));
vi.mock('../ManualCostXmlImportDialog', () => ({ ManualCostXmlImportDialog: () => null }));
vi.mock('../form/CostSummaryPanel', () => ({ CostSummaryPanel: () => null }));
vi.mock('../form/CostFormStep1', () => ({ CostFormStep1: ({ form }: { form: { register: (name: string) => object } }) => <input aria-label="Glosa" {...form.register('description')} /> }));
vi.mock('../form/CostFormStep2', () => ({ CostFormStep2: () => null }));
vi.mock('../form/CostFormStep3', () => ({ CostFormStep3: () => null }));
vi.mock('../form/CostFormStep4', () => ({ CostFormStep4: () => null }));

const cost = {
  id: 'cost-1', date: '2026-10-07', description: 'Descripción XML original', amount: 118001,
  category_id: 'inventory', subcategory: 'Partes y Piezas', inventory_movement_id: 'movement-1',
  purchase_quantity: null, purchase_unit_cost: null, payment_date: '2026-10-07',
} as Cost;

function openCost(overrides: Partial<Cost> = {}, routesToInventory = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['cost-subcategories', 'inventory'], [{ name: 'Partes y Piezas', routes_to_inventory: routesToInventory }]);
  render(<QueryClientProvider client={queryClient}><CostForm isOpen cost={{ ...cost, ...overrides }} onClose={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Glosa'), { target: { value: 'Glosa corregida' } });
  fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }));
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('editar glosa de un costo ya vinculado a bodega', () => {
  it.each([false, true])('guarda sin exigir datos de compra bloqueados (routes_to_inventory=%s)', async routes => {
    openCost({}, routes);
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ id: 'cost-1', description: 'Glosa corregida', amount: 118001 });
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.add).not.toHaveBeenCalled();
    const onSuccess = mocks.update.mock.calls[0][1].onSuccess;
    await onSuccess([]);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('sigue exigiendo cantidad si el costo aún no tiene movimiento de inventario', async () => {
    openCost({ inventory_movement_id: null });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Cantidad requerida', expect.any(Object)));
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
