import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showSyncToast, type SyncAction } from '../syncToast';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('showSyncToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows simple success toast for single action', () => {
    const actions: SyncAction[] = [
      { module: 'costo', action: 'Costo registrado', success: true },
    ];
    showSyncToast('Operación completada', actions);
    expect(toast.success).toHaveBeenCalledWith('Operación completada');
  });

  it('shows detailed success toast for multiple actions', () => {
    const actions: SyncAction[] = [
      { module: 'costo', action: 'Costo registrado', success: true },
      { module: 'inventario', action: 'Entrada inventario', success: true },
      { module: 'pago', action: 'Pago creado', success: true },
    ];
    showSyncToast('Compra registrada', actions);
    expect(toast.success).toHaveBeenCalledWith('Compra registrada', {
      description: '💰 Costo registrado\n📦 Entrada inventario\n💳 Pago creado',
      duration: 4000,
    });
  });

  it('shows warning toast when some actions fail', () => {
    const actions: SyncAction[] = [
      { module: 'costo', action: 'Costo registrado', success: true },
      { module: 'inventario', action: 'Error en inventario', success: false },
    ];
    showSyncToast('Compra parcial', actions);
    expect(toast.warning).toHaveBeenCalledWith('Compra parcial', {
      description: '💰 Costo registrado\n✗ Error en inventario',
      duration: 5000,
    });
  });

  it('uses correct icons for each module', () => {
    const actions: SyncAction[] = [
      { module: 'costo', action: 'A', success: true },
      { module: 'pago', action: 'B', success: true },
      { module: 'inventario', action: 'C', success: true },
      { module: 'pieza', action: 'D', success: true },
      { module: 'proveedor', action: 'E', success: true },
    ];
    showSyncToast('Test', actions);
    expect(toast.success).toHaveBeenCalledWith('Test', {
      description: '💰 A\n💳 B\n📦 C\n🔧 D\n🏢 E',
      duration: 4000,
    });
  });
});
