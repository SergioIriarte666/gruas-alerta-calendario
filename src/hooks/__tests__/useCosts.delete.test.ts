import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

import { deleteCostRecord } from '@/hooks/useCosts';

describe('deleteCostRecord', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('desvincula el movimiento antes de borrar el costo', async () => {
    const operations: string[] = [];

    fromMock
      .mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              operations.push('select');
              return {
                data: { service_id: 'service-1', inventory_movement_id: 'movement-1' },
                error: null,
              };
            },
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        update: (payload: unknown) => ({
          eq: async () => {
            operations.push('unlink');
            expect(payload).toEqual({ inventory_movement_id: null });
            return { error: null };
          },
        }),
      }));

    rpcMock.mockImplementation(async () => {
      operations.push('delete');
      return { data: 'service-1', error: null };
    });

    await expect(deleteCostRecord('cost-1')).resolves.toBe('service-1');

    expect(operations).toEqual(['select', 'unlink', 'delete']);
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(fromMock).toHaveBeenNthCalledWith(1, 'costs');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'costs');
  });

  it('borra directamente un costo sin vínculo a bodega', async () => {
    const operations: string[] = [];

    fromMock.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            operations.push('select');
            return {
              data: { service_id: null, inventory_movement_id: null },
              error: null,
            };
          },
        }),
      }),
    }));

    rpcMock.mockImplementation(async () => {
      operations.push('delete');
      return { data: null, error: null };
    });

    await expect(deleteCostRecord('cost-2')).resolves.toBeNull();

    expect(operations).toEqual(['select', 'delete']);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('no intenta borrar si falla la desvinculación', async () => {
    fromMock
      .mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { service_id: null, inventory_movement_id: 'movement-1' },
              error: null,
            }),
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        update: () => ({
          eq: async () => ({ error: { message: 'unlink failed' } }),
        }),
      }));

    await expect(deleteCostRecord('cost-3')).rejects.toThrow('unlink failed');
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // El borrado va por RPC y no por .delete() directo para que el historial sepa
  // DESDE DÓNDE se pidió: sin eso, un borrado del wizard por bug y uno
  // intencional desde Finanzas se leen igual en cost_change_history.
  it('sella el origen del borrado en la llamada', async () => {
    fromMock.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { service_id: 'service-9', inventory_movement_id: null },
            error: null,
          }),
        }),
      }),
    }));

    rpcMock.mockResolvedValue({ data: 'service-9', error: null });

    await deleteCostRecord('cost-4', 'wizard');

    expect(rpcMock).toHaveBeenCalledWith('delete_cost_with_context', {
      p_cost_id: 'cost-4',
      p_context: 'wizard',
    });
  });

  it('propaga el rechazo de la RPC en vez de reportar éxito', async () => {
    fromMock.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { service_id: null, inventory_movement_id: null },
            error: null,
          }),
        }),
      }),
    }));

    rpcMock.mockResolvedValue({ data: null, error: { message: 'No tienes permiso para eliminar el costo' } });

    await expect(deleteCostRecord('cost-5')).rejects.toMatchObject({
      message: 'No tienes permiso para eliminar el costo',
    });
  });
});
